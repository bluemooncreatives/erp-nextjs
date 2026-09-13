'use server';

// Project management actions - ports of Modules/Project's Project, Section,
// Task, Team, Workspace and Tag controllers.

import { revalidatePath } from 'next/cache';
import { addTaskAttachment, deleteTaskAttachment } from '@/lib/project/attachments';
import { fileFrom } from '@/lib/uploads';
import { moveProjectItem } from '@/lib/project/ordering';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import {
  createProject,
  updateProject,
  deleteProject,
  shareProject,
  removeProjectUser,
  updateProjectElement,
  setProjectDefaultView,
  addProjectComment,
  editProjectComment,
  deleteProjectComment,
  createSection,
  renameSection,
  deleteSection,
  createTask,
  findTask,
  renameTask,
  setTaskComplete,
  deleteTask,
  setTaskLike,
  addTaskComment,
  pinTaskComment,
  deleteTaskComment,
  attachTag,
  detachTag,
  createTeam,
  updateTeam,
  attachTeamMembers,
  removeTeamMember,
  createWorkspace,
  switchWorkspace,
  userIdsByEmail,
  findProject,
} from '@/lib/project/repository';
import { ROUTES, route } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type ProjectFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function emails(formData: FormData, key: string): string[] {
  return str(formData, key)
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function projectPath(uuid: string): string {
  return route('project.show', { uuid });
}

// --- workspaces ------------------------------------------------------------

/** `WorkspaceController@store` */
export async function storeWorkspace(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();
  const name = str(formData, 'name');
  if (!name) return { fieldErrors: { name: 'The name field is required.' } };

  try {
    const memberIds = await userIdsByEmail(emails(formData, 'members'));
    await createWorkspace({ name, memberIds }, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['workspaces.index']);
  revalidatePath('/', 'layout');
  return { success: 'Workspace created successfully' };
}

export async function selectWorkspace(formData: FormData): Promise<void> {
  const user = await requireUser();
  await switchWorkspace(user.id, Number(formData.get('workspace_id')));
  revalidatePath('/', 'layout');
}

// --- teams -----------------------------------------------------------------

/** `TeamController@store` */
export async function storeTeam(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();
  const name = str(formData, 'name');
  if (!name) return { fieldErrors: { name: 'The name field is required.' } };

  try {
    const memberIds = await userIdsByEmail(emails(formData, 'members'));
    await createTeam(
      {
        name,
        description: str(formData, 'description') || null,
        privacyType: Number(formData.get('privacy_type')) || 0,
        memberIds,
      },
      user.id,
      user.currentWorkspaceId,
    );
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['team.index']);
  return { success: 'Team created successfully' };
}

/** `TeamController@update` */
export async function saveTeam(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  await requireUser();
  const id = Number(formData.get('id'));

  await updateTeam(id, {
    name: str(formData, 'name') || undefined,
    description: str(formData, 'description') || null,
  });

  revalidatePath(route('team.show', { id }));
  return { success: 'Team updated successfully' };
}

/** `TeamController@teamInviteStore` */
export async function inviteToTeam(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  await requireUser();
  const teamId = Number(formData.get('team_id'));

  const memberIds = await userIdsByEmail(emails(formData, 'members'));
  if (!memberIds.length) {
    return { fieldErrors: { members: 'No user matches those addresses.' } };
  }

  await attachTeamMembers(teamId, memberIds);
  revalidatePath(route('team.show', { id: teamId }));
  return { success: 'Members invited successfully' };
}

/** `UserController@removeTeam` */
export async function removeFromTeam(formData: FormData): Promise<void> {
  await requireUser();
  const teamId = Number(formData.get('team_id'));
  await removeTeamMember(teamId, Number(formData.get('user_id')));
  revalidatePath(route('team.show', { id: teamId }));
}

// --- projects --------------------------------------------------------------

/** `ProjectController@store` */
export async function storeProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();
  const name = str(formData, 'name');
  if (!name) return { fieldErrors: { name: 'The name field is required.' } };

  let uuid: string;
  try {
    const project = await createProject(
      {
        name,
        teamId: Number(formData.get('team_id')) || null,
        description: str(formData, 'description') || null,
        privacy: Number(formData.get('privacy')) || 1,
        defaultView: str(formData, 'default_view') || 'list',
      },
      user.id,
    );
    uuid = project.uuid;
    await successLog(`Project ${name} created`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  redirect(projectPath(uuid));
}

/** `ProjectController@update` */
export async function saveProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  await requireUser();
  const id = Number(formData.get('project_id'));

  await updateProject(id, {
    name: str(formData, 'name') || undefined,
    description: str(formData, 'description') || null,
    dueDate: str(formData, 'due_date') || null,
    userId: Number(formData.get('user_id')) || null,
  });

  const project = await findProject(id);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
  return { success: 'Project updated successfully' };
}

/** `ProjectController@shareProject` */
export async function shareProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  formData = actionFormData(_prev, formData);
  await requireUser();
  const projectId = Number(formData.get('project_id'));

  const memberIds = await userIdsByEmail(emails(formData, 'members'));
  if (!memberIds.length) {
    return { fieldErrors: { members: 'No user matches those addresses.' } };
  }

  await shareProject(projectId, memberIds);

  const project = await findProject(projectId);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
  return { success: 'Project shared successfully' };
}

/** `ProjectController@removeUser` */
export async function removeProjectMember(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = Number(formData.get('project_id'));
  await removeProjectUser(projectId, Number(formData.get('user_id')));

  const project = await findProject(projectId);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

/** `ProjectController@updateColor` / `@updateIcon` / `@updateFavorite` */
export async function updateProjectPreference(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = Number(formData.get('project_id'));
  const element = String(formData.get('element')) as'icon' | 'color' | 'favourite';
  const value = String(formData.get('value') ?? '');

  await updateProjectElement(
    projectId,
    user.id,
    element,
    element === 'favourite' ? Number(value) : value,
  );

  const project = await findProject(projectId);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
  revalidatePath(ROUTES['project.index']);
}

/** `ProjectController@defaultView` */
export async function changeProjectView(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = Number(formData.get('project_id'));
  await setProjectDefaultView(projectId, String(formData.get('view') ?? 'list'));

  const project = await findProject(projectId);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

/** `ProjectController@deleteProject` */
export async function destroyProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const teamId = await deleteProject(Number(formData.get('project_id')));
  await successLog('Project deleted', user.id);

  revalidatePath(ROUTES['project.index']);
  redirect(teamId ? route('team.show', { id: teamId }) : ROUTES['project.index']);
}

/** `ProjectController@comment` / `@editComment` / `@deleteComment` */
export async function commentOnProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = Number(formData.get('project_id'));

  await addProjectComment(
    {
      projectId,
      parentId: Number(formData.get('parent_id')) || null,
      comment: str(formData, 'comment'),
    },
    user.id,
  );

  const project = await findProject(projectId);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

export async function updateProjectComment(formData: FormData): Promise<void> {
  await requireUser();
  await editProjectComment(Number(formData.get('comment_id')), str(formData, 'comment'));

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

export async function destroyProjectComment(formData: FormData): Promise<void> {
  await requireUser();
  await deleteProjectComment(Number(formData.get('comment_id')));

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

// --- sections --------------------------------------------------------------

/** `SectionController@store` */
export async function storeSection(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = Number(formData.get('project_id'));
  const name = str(formData, 'name');
  if (!name) return;

  await createSection({ projectId, name });

  const project = await findProject(projectId);
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

/** `SectionController@updateName` */
export async function updateSectionName(formData: FormData): Promise<void> {
  await requireUser();
  await renameSection(Number(formData.get('section_id')), str(formData, 'name'));

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

/** `SectionController@delete` */
export async function destroySection(formData: FormData): Promise<void> {
  await requireUser();
  await deleteSection(Number(formData.get('section_id')));

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

// --- tasks -----------------------------------------------------------------

/** `TaskController@store` */
export async function storeTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = Number(formData.get('project_id')) || null;
  const name = str(formData, 'name');
  if (!name) return;

  await createTask(
    {
      projectId,
      sectionId: Number(formData.get('section_id')) || null,
      parentId: Number(formData.get('parent_id')) || null,
      name,
      addTo: 'append',
    },
    user.id,
  );

  if (projectId) {
    const project = await findProject(projectId);
    if (project?.uuid) revalidatePath(projectPath(project.uuid));
  }
}

/** `TaskController@updateName` */
export async function updateTaskName(formData: FormData): Promise<void> {
  const user = await requireUser();
  await renameTask(Number(formData.get('task_id')), str(formData, 'name'), user.id);

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

/** `TaskController@taskComplete` */
export async function toggleTaskComplete(formData: FormData): Promise<void> {
  const user = await requireUser();
  await setTaskComplete(
    Number(formData.get('task_id')),
    String(formData.get('value')) === '1',
    user.id,
  );

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
  revalidatePath(ROUTES['project.index']);
}

/** `TaskController@taskDelete` */
export async function destroyTask(formData: FormData): Promise<void> {
  await requireUser();
  await deleteTask(Number(formData.get('task_id')));

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

/**
 * `TaskController@setTasks` - moving a task between sections.
 *
 * The Vue board did this by dragging, and persisted the new section and order
 * in one request. There is no drag here: each card names the section it should
 * move to, which works from the keyboard and without JavaScript, and reaches
 * the same `moveTask`. The order is the end of the target section, because a
 * select has no notion of where in the column the card was dropped.
 */
export async function moveTaskToSection(formData: FormData): Promise<void> {
  await requireUser();

  const taskId = Number(formData.get('task_id'));
  const raw = String(formData.get('section_id') ?? '');
  const sectionId = raw === '' ? null : Number(raw);
  if (!taskId) return;

  await moveProjectItem(Number(formData.get('project_id')), 'task', taskId, sectionId, Number(formData.get('order') ?? 0));

  const project = await findProject(Number(formData.get('project_id')));
  if (project?.uuid) revalidatePath(projectPath(project.uuid));
}

// --- task attachments ------------------------------------------------------

export type AttachmentState = { error?: string; success?: string };

/** `Upload/UploadController@upload`, scoped to one task. */
export async function uploadTaskAttachment(
  _previous: AttachmentState,
  formData?: FormData,
): Promise<AttachmentState> {
  formData = actionFormData(_previous, formData);
  const user = await requireUser();

  const taskId = Number(formData.get('task_id'));
  const file = fileFrom(formData, 'file');
  if (!taskId || !file) return { error: 'Choose a file to attach.' };

  const result = await addTaskAttachment(taskId, file, user.id);
  if (!result.ok) return { error: result.message };

  await revalidateTask(taskId);
  return { success: 'File attached.' };
}

/** `Upload/UploadController@destroy` */
export async function removeTaskAttachment(formData: FormData): Promise<void> {
  await requireUser();

  const taskId = await deleteTaskAttachment(Number(formData.get('upload_id')));
  if (taskId != null) await revalidateTask(taskId);
}

/** The task screen and the project's Files view both list attachments. */
async function revalidateTask(taskId: number): Promise<void> {
  const task = await findTask(taskId);
  if (task?.uuid) revalidatePath(route('task.show', { uuid: task.uuid }));
  if (task?.projectId) {
    const project = await findProject(task.projectId);
    if (project?.uuid) revalidatePath(projectPath(project.uuid));
  }
}

/** `TaskController@taskLike` */
export async function toggleTaskLike(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = Number(formData.get('task_id'));
  await setTaskLike(taskId, user.id, String(formData.get('value')) === '1');
  revalidatePath(route('task.show', { uuid: String(formData.get('uuid') ?? '') }));
}

/** `TaskController@taskComment` */
export async function commentOnTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = Number(formData.get('task_id'));
  const comment = str(formData, 'comment');
  if (!comment) return;

  await addTaskComment(taskId, comment, user.id);
  revalidatePath(route('task.show', { uuid: String(formData.get('uuid') ?? '') }));
}

/** `TaskController@taskCommentPinToTop` */
export async function pinComment(formData: FormData): Promise<void> {
  await requireUser();
  await pinTaskComment(
    Number(formData.get('comment_id')),
    String(formData.get('pin')) === '1',
  );
  revalidatePath(route('task.show', { uuid: String(formData.get('uuid') ?? '') }));
}

/** `TaskController@taskCommentDelete` */
export async function destroyTaskComment(formData: FormData): Promise<void> {
  await requireUser();
  await deleteTaskComment(Number(formData.get('comment_id')));
  revalidatePath(route('task.show', { uuid: String(formData.get('uuid') ?? '') }));
}

// --- tags ------------------------------------------------------------------

/** `TagController@storeTag` */
export async function storeTag(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = Number(formData.get('task_id'));
  const name = str(formData, 'name');
  if (!name) return;

  await attachTag(taskId, name, user.currentWorkspaceId, user.id);
  revalidatePath(route('task.show', { uuid: String(formData.get('uuid') ?? '') }));
}

/** `TagController@removeTag` */
export async function removeTag(formData: FormData): Promise<void> {
  await requireUser();
  await detachTag(Number(formData.get('task_id')), Number(formData.get('tag_id')));
  revalidatePath(route('task.show', { uuid: String(formData.get('uuid') ?? '') }));
}
