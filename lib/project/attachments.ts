// Task attachments - port of Modules/Project `Upload\UploadController`.
//
// The PHP stored every upload in one `uploads` table keyed by `module` and
// `module_id`, wrote the file under `public/uploads/{module}/`, and enforced
// its limits from a config array: at most 5 files of at most 10MB each, and a
// fixed extension list. Those limits are kept here.
//
// `module` is `'task'`. The Vue component that chose that string is not in this
// codebase - `Modules/Project/Resources/assets/js` holds a stub - and the
// `uploads` table in the dump is empty, so there is no existing value to match.
// It is a constant here rather than a request field, which also closes the
// PHP's hole: `module` came straight from the request, so a caller could write
// rows under any module name it liked.

import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tasks, uploads } from '@/lib/db/schema';
import { requireProjectAccess } from './fields';
import { saveUpload, deleteStoredFile } from '@/lib/uploads';

export const TASK_MODULE = 'task';

/** `$max_no_of_files` and `$max_file_size` from the upload config. */
export const MAX_FILES_PER_TASK = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** `$allowed_file_extensions`. */
export const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
];

export type Attachment = {
  id: number;
  taskId: number | null;
  userFilename: string | null;
  filename: string | null;
  fileType: string | null;
  createdAt: Date | null;
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export async function taskAttachments(taskId: number): Promise<Attachment[]> {
  const rows = await db
    .select({
      id: uploads.id,
      taskId: uploads.moduleId,
      userFilename: uploads.userFilename,
      filename: uploads.filename,
      fileType: uploads.fileType,
      createdAt: uploads.createdAt,
    })
    .from(uploads)
    .where(
      and(
        eq(uploads.module, TASK_MODULE),
        eq(uploads.moduleId, taskId),
        eq(uploads.isTempDelete, 0),
      ),
    )
    .orderBy(desc(uploads.id));
  return rows;
}

/** Every attachment on a project's tasks - what the Files view lists. */
export async function projectAttachments(projectId: number) {
  const projectTasks = await db
    .select({ id: tasks.id, name: tasks.name, uuid: tasks.uuid })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  if (projectTasks.length === 0) return [];

  const rows = await db
    .select({
      id: uploads.id,
      taskId: uploads.moduleId,
      userFilename: uploads.userFilename,
      filename: uploads.filename,
      fileType: uploads.fileType,
      createdAt: uploads.createdAt,
    })
    .from(uploads)
    .where(
      and(
        eq(uploads.module, TASK_MODULE),
        inArray(
          uploads.moduleId,
          projectTasks.map((task) => task.id),
        ),
        eq(uploads.isTempDelete, 0),
      ),
    )
    .orderBy(desc(uploads.id));

  const byId = new Map(projectTasks.map((task) => [task.id, task]));
  return rows.map((row) => ({
    ...row,
    task: row.taskId != null ? (byId.get(row.taskId) ?? null) : null,
  }));
}

export type AttachmentError =
  | { ok: true }
  | { ok: false; message: string };

/**
 * `UploadController@upload`, with its three guards: the extension list, the
 * size ceiling, and the per-module file count.
 */
export async function addTaskAttachment(
  taskId: number,
  file: File,
  userId: number,
): Promise<AttachmentError> {
  const [task] = await db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task?.projectId) return { ok: false, message: 'Task not found.' };
  await requireProjectAccess(task.projectId);
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { ok: false, message: `Files of type .${extension || '?'} are not allowed.` };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: 'That file is larger than 10MB.' };
  }

  const existing = await taskAttachments(taskId);
  if (existing.length >= MAX_FILES_PER_TASK) {
    return {
      ok: false,
      message: `A task can hold ${MAX_FILES_PER_TASK} files; remove one first.`,
    };
  }

  const stored = await saveUpload(file, `${TASK_MODULE}`);
  if (!stored) return { ok: false, message: 'The file could not be saved.' };

  await db.insert(uploads).values({
    uuid: crypto.randomUUID(),
    userId,
    module: TASK_MODULE,
    moduleId: taskId,
    uploadToken: crypto.randomUUID(),
    userFilename: file.name,
    filename: stored,
    fileType: file.type || extension,
    isTempDelete: 0,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { ok: true };
}

/** `UploadController@destroy` - the row and the file behind it. */
export async function deleteTaskAttachment(id: number): Promise<number | null> {
  const [row] = await db
    .select({ id: uploads.id, filename: uploads.filename, taskId: uploads.moduleId })
    .from(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.module, TASK_MODULE)))
    .limit(1);
  if (!row) return null;
  const [task] = row.taskId ? await db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, row.taskId)).limit(1) : [];
  if (!task?.projectId) return null;
  await requireProjectAccess(task.projectId);

  await db.delete(uploads).where(eq(uploads.id, id));
  await deleteStoredFile(row.filename);
  return row.taskId ?? null;
}
