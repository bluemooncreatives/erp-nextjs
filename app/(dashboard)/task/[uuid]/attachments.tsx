'use client';

// Task attachments - `Upload/UploadController`.
//
// The Files view used to say "open a task to see and add attachments" and the
// task screen had no attachment UI at all, so the instruction led nowhere.

import { useActionState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { Card } from '@/components/erp/page';
import { FormAlert } from '@/components/erp/fields';
import { SubmitButton, ActionButton } from '@/components/erp/submit-button';
import { assetUrl } from '@/lib/paths';
import {
  uploadTaskAttachment,
  removeTaskAttachment,
  type AttachmentState,
} from '@/app/(dashboard)/project/actions';

const INITIAL: AttachmentState = {};

export function TaskAttachments({
  taskId,
  files,
  limit,
  allowed,
}: {
  taskId: number;
  files: Array<{
    id: number;
    userFilename: string | null;
    filename: string | null;
  }>;
  limit: number;
  allowed: string[];
}) {
  const [state, formAction] = useActionState(uploadTaskAttachment, INITIAL);

  return (
    <Card
      title={`Attachments (${files.length})`}
      desc={`Up to ${limit} files of 10MB each - ${allowed.join(', ')}.`}
    >
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <a
              href={assetUrl(file.filename) ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-primary flex min-w-0 items-center gap-2 text-sm"
            >
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{file.userFilename ?? 'File'}</span>
            </a>
            <form action={removeTaskAttachment}>
              <input type="hidden" name="upload_id" value={file.id} />
              <ActionButton
                variant="danger"
                confirm="Remove this attachment?"
                aria-label={`Remove ${file.userFilename ?? 'file'}`}
              >
                <Trash2 className="size-3.5" />
              </ActionButton>
            </form>
          </li>
        ))}
        {files.length === 0 ? (
          <li className="text-muted-foreground text-sm">Nothing attached yet.</li>
        ) : null}
      </ul>

      {files.length < limit ? (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="task_id" value={taskId} />

          <FormAlert variant="error" message={state.error} />
          <FormAlert variant="success" message={state.success} />

          <input
            type="file"
            name="file"
            required
            accept={allowed.map((extension) => `.${extension}`).join(',')}
            className="border-border file:bg-muted file:text-foreground w-full rounded-lg border bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
          />
          <SubmitButton size="sm">Attach file</SubmitButton>
        </form>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          This task holds the maximum of {limit} files.
        </p>
      )}
    </Card>
  );
}
