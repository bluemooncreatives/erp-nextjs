import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db, transaction } from '@/lib/db/client';
import { fields, fieldOptions, fieldProject, fieldTask, projects, projectUser, teamUser, taskComments, tasks } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/permissions';

export async function requireProjectAccess(projectId: number) {
  const user = await requireUser();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const [member] = await db.select().from(projectUser).where(and(eq(projectUser.projectId, projectId), eq(projectUser.userId, user.id))).limit(1);
  const [teamMember] = project?.teamId ? await db.select().from(teamUser).where(and(eq(teamUser.teamId, project.teamId), eq(teamUser.userId, user.id))).limit(1) : [];
  if (!project || (!user.isSystemUser && project.userId !== user.id && !member && !teamMember)) throw new Error('Project access denied.');
  return { user, project };
}

export async function projectFields(projectId: number, taskId?: number) {
  const rows = await db.select({ field: fields, link: fieldProject }).from(fieldProject)
    .innerJoin(fields, eq(fields.id, fieldProject.fieldId)).where(eq(fieldProject.projectId, projectId)).orderBy(asc(fieldProject.order));
  return Promise.all(rows.map(async (row) => {
    const options = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, row.field.id));
    const [value] = taskId ? await db.select().from(fieldTask).where(and(eq(fieldTask.taskId, taskId), eq(fieldTask.fieldId, row.field.id))).limit(1) : [];
    return { ...row, options, value: value ?? null };
  }));
}

/** FieldService::store, preserving existing option IDs when labels are edited. */
export async function saveField(projectId: number, data: FormData) {
  const { user } = await requireProjectAccess(projectId);
  const id = Number(data.get('field_id'));
  const name = String(data.get('name') ?? '').trim();
  const type = String(data.get('type') ?? 'text');
  if (!name || name.length > 191 || !['text', 'number', 'date', 'dropdown', 'user_id'].includes(type)) throw new Error('Enter a field name and valid type.');
  const current = (await projectFields(projectId)).find((r) => r.field.id === id);
  if (id && (!current || current.field.default === 1)) throw new Error('This field cannot be edited.');
  if (current && current.field.type !== type) throw new Error('Existing field types cannot be changed.');
  const format = String(data.get('format') ?? current?.field.format ?? 'unformat');
  const decimals = Number(data.get('decimals') ?? current?.field.decimal ?? 2);
  const label = String(data.get('label') ?? current?.field.label ?? '');
  const position = String(data.get('position') ?? current?.field.position ?? 'right');
  if (!['unformat', 'number', 'percent', 'usd', 'custom'].includes(format.toLowerCase()) || !Number.isInteger(decimals) || decimals < 0 || decimals > 6 || label.length > 50 || !['left', 'right'].includes(position)) throw new Error('Invalid number format.');
  const labels = String(data.get('options') ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (type === 'dropdown' && (!labels.length || labels.some((s) => s.length > 191))) throw new Error('Enter dropdown options, one per line.');
  await transaction(async (tx) => {
    const values = { name, type, format, decimal: String(decimals), label, position, description: String(data.get('description') ?? ''), editable: 1, updatedAt: new Date() };
    let fieldId = id;
    if (id) await tx.update(fields).set(values).where(eq(fields.id, id));
    else {
      const [insert] = await tx.insert(fields).values({ ...values, userId: user.id, createdAt: new Date() });
      fieldId = Number(insert.insertId);
      await tx.insert(fieldProject).values({ projectId, fieldId, visibility: 1 });
      const existingTasks = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, projectId));
      if (existingTasks.length) await tx.insert(fieldTask).values(existingTasks.map((task) => ({ taskId: task.id, fieldId })));
    }
    if (type === 'dropdown') {
      for (let index = 0; index < labels.length; index++) {
        const existing = current?.options[index];
        if (existing) await tx.update(fieldOptions).set({ option: labels[index] }).where(eq(fieldOptions.id, existing.id));
        else await tx.insert(fieldOptions).values({ fieldId, option: labels[index], color: '#6457f9' });
      }
      for (const removed of current?.options.slice(labels.length) ?? []) {
        await tx.update(fieldTask).set({ optionId: null }).where(eq(fieldTask.optionId, removed.id));
        await tx.delete(fieldOptions).where(eq(fieldOptions.id, removed.id));
      }
    }
  });
}

export async function saveFieldValue(projectId: number, taskId: number, fieldId: number, raw: string) {
  const { user } = await requireProjectAccess(projectId);
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId))).limit(1);
  const row = (await projectFields(projectId, taskId)).find((r) => r.field.id === fieldId);
  if (!task || !row) throw new Error('Task or field not found in this project.');
  const value: Partial<typeof fieldTask.$inferInsert> = { text: null, number: null, date: null, optionId: null, userId: null, updatedAt: new Date() };
  if (raw !== '') {
    switch (row.field.type) {
      case 'text': value.text = raw; break;
      case 'number': if (!Number.isFinite(Number(raw))) throw new Error('Enter a valid number.'); value.number = Number(raw); break;
      case 'date': if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || new Date(raw).toISOString().slice(0, 10) !== raw) throw new Error('Enter a valid date.'); value.date = new Date(raw); break;
      case 'dropdown': if (!row.options.some((o) => o.id === Number(raw))) throw new Error('Select a valid option.'); value.optionId = Number(raw); break;
      case 'user_id': {
        const [member] = await db.select().from(projectUser).where(and(eq(projectUser.projectId, projectId), eq(projectUser.userId, Number(raw)))).limit(1);
        if (!member) throw new Error('Select a project member.');
        value.userId = Number(raw); break;
      }
      default: throw new Error('Unsupported field type.');
    }
  }
  await transaction(async (tx) => {
    if (row.value) await tx.update(fieldTask).set(value).where(eq(fieldTask.id, row.value.id));
    else await tx.insert(fieldTask).values({ ...value, taskId, fieldId });
    await tx.insert(taskComments).values({ taskId, fieldId, createdBy: user.id, event: 'update_field', comment: `${row.field.name ?? 'Field'}: ${raw || 'cleared'}`, oldValue: row.value ? JSON.stringify({ text: row.value.text, number: row.value.number, date: row.value.date, optionId: row.value.optionId, userId: row.value.userId }) : null, createdAt: new Date(), updatedAt: new Date() });
  });
}

export async function changeField(projectId: number, fieldId: number, operation: string) {
  await requireProjectAccess(projectId);
  const row = (await projectFields(projectId)).find((r) => r.field.id === fieldId);
  if (!row) throw new Error('Field not found.');
  if (operation === 'visibility') await db.update(fieldProject).set({ visibility: row.link.visibility ? 0 : 1 }).where(eq(fieldProject.id, row.link.id));
  else if (operation === 'delete') {
    if (row.field.default) throw new Error('Default fields cannot be removed.');
    await transaction(async (tx) => {
      const projectTasks = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, projectId));
      for (const task of projectTasks) await tx.delete(fieldTask).where(and(eq(fieldTask.taskId, task.id), eq(fieldTask.fieldId, fieldId)));
      await tx.delete(fieldProject).where(eq(fieldProject.id, row.link.id));
      // A library field may also be attached to another project.
      const [other] = await tx.select().from(fieldProject).where(eq(fieldProject.fieldId, fieldId)).limit(1);
      if (!other) { await tx.delete(fieldOptions).where(eq(fieldOptions.fieldId, fieldId)); await tx.delete(fields).where(eq(fields.id, fieldId)); }
    });
  } else throw new Error('Invalid field operation.');
}


export async function projectFieldValues(projectId: number) {
  return db.select({ value: fieldTask }).from(fieldTask).innerJoin(tasks, eq(tasks.id, fieldTask.taskId)).where(eq(tasks.projectId, projectId));
}
