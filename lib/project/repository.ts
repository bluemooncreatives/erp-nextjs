// ---------------------------------------------------------------------------
// Project management - port of Modules/Project's repositories and services
// (WorkSpaceService, TeamService, ProjectService, SectionService, TaskService).
//
// The PHP front end was a Vue SPA talking to these services over JSON; the port
// keeps the same data model and the same write semantics, driven by server
// actions instead of the API endpoints.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  fieldProject,
  fieldTask,
  fields,
  projectComments,
  projectUser,
  projects,
  sections,
  tagTask,
  tags,
  taskComments,
  taskLikes,
  tasks,
  teamUser,
  teams,
  users,
  workspaces,
} from '@/lib/db/schema';

/** `uniqid('pro-')` etc - PHP's uniqid is a 13-char hex timestamp. */
export function uniqid(prefix = ''): string {
  const now = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return `${prefix}${now.toString(16).padStart(13, '0').slice(-13)}`;
}

// --- workspaces ------------------------------------------------------------

/** `WorkSpaceRepository::allWorkspace()` - own workspaces plus team ones. */
export async function userWorkspaces(userId: number) {
  const viaTeams = await db
    .selectDistinct({ workspaceId: teams.workspaceId })
    .from(teamUser)
    .innerJoin(teams, eq(teams.id, teamUser.teamId))
    .where(eq(teamUser.userId, userId));

  const ids = new Set<number>();
  for (const row of viaTeams) if (row.workspaceId) ids.add(row.workspaceId);

  const own = await db.select().from(workspaces).where(eq(workspaces.userId, userId));
  for (const row of own) ids.add(row.id);

  if (!ids.size) return [];
  return db
    .select()
    .from(workspaces)
    .where(inArray(workspaces.id, [...ids]))
    .orderBy(asc(workspaces.id));
}

/**
 * `WorkSpaceService::store()` - creating a workspace also creates a team of the
 * same name and attaches the invited members to it.
 */
export async function createWorkspace(
  data: { name: string; memberIds: number[] },
  userId: number,
): Promise<number> {
  const [inserted] = await db.insert(workspaces).values({
    name: data.name,
    userId,
    defaultWorkspace: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const workspaceId = Number(inserted.insertId);

  const [team] = await db.insert(teams).values({
    uuid: uniqid('team-'),
    name: data.name,
    userId,
    workspaceId,
    privacyType: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const teamId = Number(team.insertId);

  await attachTeamMembers(teamId, data.memberIds);

  // `Auth::user()->switchWorkspace($workspace)`
  await db
    .update(users)
    .set({ currentWorkspaceId: workspaceId, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return workspaceId;
}

export async function switchWorkspace(userId: number, workspaceId: number): Promise<void> {
  await db
    .update(users)
    .set({ currentWorkspaceId: workspaceId, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// --- teams -----------------------------------------------------------------

export async function attachTeamMembers(teamId: number, memberIds: number[]): Promise<void> {
  const unique = [...new Set(memberIds)].filter(Boolean);
  if (!unique.length) return;

  const existing = await db
    .select({ userId: teamUser.userId })
    .from(teamUser)
    .where(eq(teamUser.teamId, teamId));
  const already = new Set(existing.map((row) => row.userId));

  const rows = unique
    .filter((id) => !already.has(id))
    .map((userId) => ({ teamId, userId, createdAt: new Date(), updatedAt: new Date() }));

  if (rows.length) await db.insert(teamUser).values(rows);
}

/** `WorkSpaceRepository::allTeamForUserCurrentWorkspace()` */
export async function teamsInWorkspace(workspaceId: number, userId: number) {
  const rows = await db
    .select({ team: teams })
    .from(teams)
    .where(eq(teams.workspaceId, workspaceId))
    .orderBy(asc(teams.id));

  const memberships = await db
    .select({ teamId: teamUser.teamId })
    .from(teamUser)
    .where(eq(teamUser.userId, userId));
  const member = new Set(memberships.map((m) => m.teamId));

  return rows
    .map((r) => r.team)
    .filter((team) => team.userId === userId || member.has(team.id));
}

export async function findTeam(id: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) return null;

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, avatar: users.avatar })
    .from(teamUser)
    .innerJoin(users, eq(users.id, teamUser.userId))
    .where(eq(teamUser.teamId, id));

  const teamProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.teamId, id))
    .orderBy(desc(projects.id));

  return { team, members, projects: teamProjects };
}

/** `TeamService::store()` */
export async function createTeam(
  data: {
    name: string;
    description?: string | null;
    privacyType?: number;
    memberIds: number[];
  },
  userId: number,
  workspaceId: number | null,
): Promise<number> {
  const [inserted] = await db.insert(teams).values({
    uuid: uniqid('team-'),
    name: data.name,
    description: data.description ?? null,
    userId,
    workspaceId,
    privacyType: data.privacyType ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const teamId = Number(inserted.insertId);
  await attachTeamMembers(teamId, data.memberIds);
  return teamId;
}

export async function updateTeam(
  id: number,
  data: { name?: string; description?: string | null },
): Promise<void> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) values.name = data.name;
  if (data.description !== undefined) values.description = data.description;
  await db.update(teams).set(values).where(eq(teams.id, id));
}

export async function removeTeamMember(teamId: number, userId: number): Promise<void> {
  await db
    .delete(teamUser)
    .where(and(eq(teamUser.teamId, teamId), eq(teamUser.userId, userId)));
}

// --- projects --------------------------------------------------------------

/** `ProjectService::storeProject()` - attaches the creator and default fields. */
export async function createProject(
  data: {
    name: string;
    teamId: number | null;
    description?: string | null;
    privacy?: number | null;
    defaultView?: string | null;
  },
  userId: number,
): Promise<{ id: number; uuid: string }> {
  const uuid = uniqid('pro-');
  const defaultView = data.defaultView ?? 'list';

  const [inserted] = await db.insert(projects).values({
    name: data.name,
    userId,
    teamId: data.teamId,
    description: data.description ?? null,
    privacy: data.privacy ?? 1,
    defaultView,
    uuid,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const projectId = Number(inserted.insertId);

  await db.insert(projectUser).values({
    projectId,
    userId,
    icon: 'ti-menu-alt',
    color: '6457f9',
    defaultView,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // `$model->fields()->attach($field->id, ['order' => $key])`
  const defaults = await db.select().from(fields).where(eq(fields.default, 1));
  if (defaults.length) {
    await db.insert(fieldProject).values(
      defaults.map((field, index) => ({
        fieldId: field.id,
        projectId,
        order: index,
        visibility: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  return { id: projectId, uuid };
}

export async function findProjectByUuid(uuid: string) {
  const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid)).limit(1);
  return project ?? null;
}

export async function findProject(id: number) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return project ?? null;
}

/** Everything the project screen renders: sections, tasks, members, comments. */
export async function projectBoard(projectId: number) {
  const [sectionRows, taskRows, members, comments] = await Promise.all([
    db
      .select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(asc(sections.order)),
    db
      .select({
        task: tasks,
        createdByName: users.name,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.createdBy))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.order)),
    projectMembers(projectId),
    projectCommentThread(projectId),
  ]);

  return { sections: sectionRows, tasks: taskRows, members, comments };
}

export async function projectMembers(projectId: number) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      icon: projectUser.icon,
      color: projectUser.color,
      favourite: projectUser.favourite,
      defaultView: projectUser.defaultView,
    })
    .from(projectUser)
    .innerJoin(users, eq(users.id, projectUser.userId))
    .where(eq(projectUser.projectId, projectId));
}

/** `ProjectService::update()` */
export async function updateProject(
  id: number,
  data: {
    name?: string;
    description?: string | null;
    dueDate?: string | null;
    userId?: number | null;
  },
): Promise<void> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) values.name = data.name;
  if (data.description !== undefined) values.description = data.description;
  if (data.dueDate !== undefined) values.dueDate = data.dueDate;
  if (data.userId) values.userId = data.userId;

  await db.update(projects).set(values).where(eq(projects.id, id));

  // The service also attached the newly assigned owner as a member.
  if (data.userId) await shareProject(id, [data.userId]);
}

/** `ProjectService::shareProject()` */
export async function shareProject(projectId: number, userIds: number[]): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return;

  const existing = await db
    .select({ userId: projectUser.userId })
    .from(projectUser)
    .where(eq(projectUser.projectId, projectId));
  const already = new Set(existing.map((row) => row.userId));

  const rows = unique
    .filter((id) => !already.has(id))
    .map((userId) => ({
      projectId,
      userId,
      defaultView: 'list',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

  if (rows.length) await db.insert(projectUser).values(rows);
}

export async function removeProjectUser(projectId: number, userId: number): Promise<void> {
  await db
    .delete(projectUser)
    .where(and(eq(projectUser.projectId, projectId), eq(projectUser.userId, userId)));
}

/** `ProjectService::updateProjectElement()` - the per-user icon/colour/favourite. */
export async function updateProjectElement(
  projectId: number,
  userId: number,
  element: 'icon' | 'color' | 'favourite',
  value: string | number,
): Promise<void> {
  await db
    .update(projectUser)
    .set({ [element]: value, updatedAt: new Date() })
    .where(and(eq(projectUser.projectId, projectId), eq(projectUser.userId, userId)));
}

/**
 * This user's own `project_user` row - the colour, icon and favourite flag the
 * Vue sidebar let each member set for themselves. The project is shared; these
 * three are not.
 */
export async function projectPreference(projectId: number, userId: number) {
  const [row] = await db
    .select({
      icon: projectUser.icon,
      color: projectUser.color,
      favourite: projectUser.favourite,
      defaultView: projectUser.defaultView,
    })
    .from(projectUser)
    .where(and(eq(projectUser.projectId, projectId), eq(projectUser.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** `ProjectService::defaultView()` */
export async function setProjectDefaultView(projectId: number, view: string): Promise<void> {
  await db
    .update(projects)
    .set({ defaultView: view, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function deleteProject(id: number): Promise<number | null> {
  const project = await findProject(id);
  if (!project) return null;
  await db.delete(projects).where(eq(projects.id, id));
  return project.teamId;
}

/** Projects the signed-in user can see - own, shared, or in one of their teams. */
export async function userProjects(userId: number) {
  const shared = await db
    .select({ projectId: projectUser.projectId })
    .from(projectUser)
    .where(eq(projectUser.userId, userId));

  const teamIds = await db
    .select({ teamId: teamUser.teamId })
    .from(teamUser)
    .where(eq(teamUser.userId, userId));

  const ids = shared.map((s) => s.projectId).filter((v): v is number => v != null);
  const teamList = teamIds.map((t) => t.teamId).filter((v): v is number => v != null);

  const rows = await db
    .select({
      project: projects,
      teamName: teams.name,
      ownerName: users.name,
      taskCount: sql<number>`(select count(*) from tasks t where t.project_id = ${projects.id})`,
      doneCount: sql<number>`(
        select count(*) from tasks t where t.project_id = ${projects.id} and t.completed = 1
      )`,
    })
    .from(projects)
    .leftJoin(teams, eq(teams.id, projects.teamId))
    .leftJoin(users, eq(users.id, projects.userId))
    .orderBy(desc(projects.id));

  return rows.filter(
    (row) =>
      row.project.userId === userId ||
      ids.includes(row.project.id) ||
      (row.project.teamId != null && teamList.includes(row.project.teamId)),
  );
}

// --- project comments ------------------------------------------------------

/** `ProjectCommentRepository` + the Blade's threaded rendering. */
export async function projectCommentThread(projectId: number) {
  return db
    .select({
      comment: projectComments,
      authorName: users.name,
      authorAvatar: users.avatar,
    })
    .from(projectComments)
    .leftJoin(users, eq(users.id, projectComments.createdBy))
    .where(eq(projectComments.projectId, projectId))
    .orderBy(desc(projectComments.pinTop), asc(projectComments.id));
}

export async function addProjectComment(
  data: { projectId: number | null; parentId: number | null; comment: string },
  userId: number,
): Promise<void> {
  await db.insert(projectComments).values({
    // The service nulled `project_id` whenever the comment was a reply.
    projectId: data.parentId ? null : data.projectId,
    parentId: data.parentId,
    comment: data.comment,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function editProjectComment(id: number, comment: string): Promise<void> {
  await db
    .update(projectComments)
    .set({ comment, updatedAt: new Date() })
    .where(eq(projectComments.id, id));
}

export async function deleteProjectComment(id: number): Promise<void> {
  await db.delete(projectComments).where(eq(projectComments.id, id));
}

// --- sections --------------------------------------------------------------

/** `SectionService::store()` */
export async function createSection(
  data: { projectId: number; name: string },
): Promise<number> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sections)
    .where(eq(sections.projectId, data.projectId));

  const [inserted] = await db.insert(sections).values({
    projectId: data.projectId,
    name: data.name,
    order: Number(countRow?.count ?? 0),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number(inserted.insertId);
}

export async function renameSection(id: number, name: string): Promise<void> {
  await db.update(sections).set({ name, updatedAt: new Date() }).where(eq(sections.id, id));
}

export async function deleteSection(id: number): Promise<void> {
  await db.delete(tasks).where(eq(tasks.sectionId, id));
  await db.delete(sections).where(eq(sections.id, id));
}

// --- tasks -----------------------------------------------------------------

/**
 * `TaskService::create()` - `add_to` decides the order: 'prepend' pushes every
 * sibling down, 'append' lands at the end, a number inserts at that position.
 */
export async function createTask(
  data: {
    projectId: number | null;
    sectionId: number | null;
    parentId: number | null;
    name: string;
    addTo?: 'prepend' | 'append' | number;
  },
  userId: number,
): Promise<number> {
  const where = [];
  if (data.sectionId) where.push(eq(tasks.sectionId, data.sectionId));
  if (data.projectId) where.push(eq(tasks.projectId, data.projectId));
  if (data.parentId) where.push(eq(tasks.parentId, data.parentId));
  const scope = where.length ? and(...where) : undefined;

  const addTo = data.addTo ?? 'append';
  let order = 0;

  if (addTo === 'prepend') {
    await db
      .update(tasks)
      .set({ order: sql`${tasks.order} + 1` })
      .where(scope);
    order = 0;
  } else if (addTo === 'append') {
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(scope);
    order = Number(countRow?.count ?? 0);
  } else {
    const position = Number(addTo);
    await db
      .update(tasks)
      .set({ order: sql`${tasks.order} + 1` })
      .where(scope ? and(scope, gte(tasks.order, position)) : gte(tasks.order, position));
    order = position;
  }

  const [inserted] = await db.insert(tasks).values({
    uuid: uniqid('task-'),
    projectId: data.projectId,
    sectionId: data.sectionId,
    parentId: data.parentId,
    name: data.name,
    order,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const taskId = Number(inserted.insertId);

  // Every field on the project is attached to the new task.
  if (data.projectId) {
    const projectFields = await db
      .select({ fieldId: fieldProject.fieldId })
      .from(fieldProject)
      .where(eq(fieldProject.projectId, data.projectId));

    if (projectFields.length) {
      await db.insert(fieldTask).values(
        projectFields.map((row) => ({
          taskId,
          fieldId: row.fieldId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }
  }

  return taskId;
}

export async function findTaskByUuid(uuid: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.uuid, uuid)).limit(1);
  if (!task) return null;

  const [subTasks, comments, taskTags, likeCount] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.parentId, task.id)).orderBy(asc(tasks.order)),
    taskCommentThread(task.id),
    db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tagTask)
      .innerJoin(tags, eq(tags.id, tagTask.tagId))
      .where(eq(tagTask.taskId, task.id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(taskLikes)
      .where(eq(taskLikes.taskId, task.id)),
  ]);

  return {
    task,
    subTasks,
    comments,
    tags: taskTags,
    likes: Number(likeCount[0]?.count ?? 0),
  };
}

/**
 * `TaskService::updateName()` - posting an empty name deleted the task, and
 * every rename was journalled as a `changed_name` comment.
 */
export async function renameTask(id: number, name: string, userId: number): Promise<boolean> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) return false;

  if (!name) {
    await deleteTask(id);
    return false;
  }

  await db.insert(taskComments).values({
    event: 'changed_name',
    taskId: id,
    createdBy: userId,
    oldValue: task.name,
    comment: name,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.update(tasks).set({ name, updatedAt: new Date() }).where(eq(tasks.id, id));
  return true;
}

/** `TaskService::updateTaskCompleteStatus()` */
export async function setTaskComplete(
  id: number,
  completed: boolean,
  userId: number,
): Promise<void> {
  await db
    .update(tasks)
    .set({
      completed: completed ? 1 : 0,
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));

  await db.insert(taskComments).values({
    event: completed ? 'completed' : 'incompleted',
    taskId: id,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function deleteTask(id: number): Promise<void> {
  await db.delete(fieldTask).where(eq(fieldTask.taskId, id));
  await db.delete(taskComments).where(eq(taskComments.taskId, id));
  await db.delete(taskLikes).where(eq(taskLikes.taskId, id));
  await db.delete(tagTask).where(eq(tagTask.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function moveTask(
  id: number,
  sectionId: number | null,
  order: number,
): Promise<void> {
  await db
    .update(tasks)
    .set({ sectionId, order, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

/** `TaskService::like()` */
export async function setTaskLike(
  taskId: number,
  userId: number,
  liked: boolean,
): Promise<void> {
  if (liked) {
    const [existing] = await db
      .select({ id: taskLikes.id })
      .from(taskLikes)
      .where(and(eq(taskLikes.taskId, taskId), eq(taskLikes.userId, userId)))
      .limit(1);
    if (!existing) {
      await db
        .insert(taskLikes)
        .values({ taskId, userId, createdAt: new Date(), updatedAt: new Date() });
    }
  } else {
    await db
      .delete(taskLikes)
      .where(and(eq(taskLikes.taskId, taskId), eq(taskLikes.userId, userId)));
  }
}

// --- task comments ---------------------------------------------------------

export async function taskCommentThread(taskId: number) {
  return db
    .select({
      comment: taskComments,
      authorName: users.name,
      authorAvatar: users.avatar,
    })
    .from(taskComments)
    .leftJoin(users, eq(users.id, taskComments.createdBy))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(desc(taskComments.pinTop), asc(taskComments.id));
}

/** `TaskService::updateTaskComment()` - a plain comment has a null event. */
export async function addTaskComment(
  taskId: number,
  comment: string,
  userId: number,
): Promise<void> {
  await db.insert(taskComments).values({
    event: null,
    taskId,
    comment,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function pinTaskComment(id: number, pin: boolean): Promise<void> {
  await db
    .update(taskComments)
    .set({ pinTop: pin ? 1 : 0, updatedAt: new Date() })
    .where(eq(taskComments.id, id));
}

export async function deleteTaskComment(id: number): Promise<void> {
  await db.delete(taskComments).where(eq(taskComments.id, id));
}

// --- tags ------------------------------------------------------------------

/** `TagService::storeTag()` - reuses a workspace tag of the same name. */
export async function attachTag(
  taskId: number,
  name: string,
  workspaceId: number | null,
  userId: number,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(tags)
    .where(
      workspaceId
        ? and(eq(tags.name, name), eq(tags.workspaceId, workspaceId))
        : and(eq(tags.name, name), isNull(tags.workspaceId)),
    )
    .limit(1);

  let tagId = existing?.id;
  if (!tagId) {
    const [inserted] = await db.insert(tags).values({
      name,
      userId,
      workspaceId,
      color: 'text',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tagId = Number(inserted.insertId);
  }

  const [link] = await db
    .select({ id: tagTask.id })
    .from(tagTask)
    .where(and(eq(tagTask.taskId, taskId), eq(tagTask.tagId, tagId)))
    .limit(1);

  if (!link) {
    await db
      .insert(tagTask)
      .values({ taskId, tagId, createdAt: new Date(), updatedAt: new Date() });
  }
}

export async function detachTag(taskId: number, tagId: number): Promise<void> {
  await db.delete(tagTask).where(and(eq(tagTask.taskId, taskId), eq(tagTask.tagId, tagId)));
}

// --- people ----------------------------------------------------------------

/** `UserRepository::getUserIdByEmail()` - the invite fields took emails. */
export async function userIdsByEmail(emails: string[]): Promise<number[]> {
  const cleaned = emails.map((e) => e.trim()).filter(Boolean);
  if (!cleaned.length) return [];

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, cleaned));
  return rows.map((r) => r.id);
}

export async function activeUsers() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isActive, 1))
    .orderBy(asc(users.name));
}
