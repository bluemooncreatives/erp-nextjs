import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { transaction } from '@/lib/db/client';
import { sections, tasks } from '@/lib/db/schema';
import { requireProjectAccess } from './fields';

/** ApiService::updateTaskOrder / updateSectionOrder / updateSubTaskOrder. */
export async function moveProjectItem(projectId: number, kind: string, id: number, target: number | null, position: number) {
  await requireProjectAccess(projectId);
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(position) || position < 0 || position > 65535) throw new Error('Invalid position.');
  await transaction(async (tx) => {
    // A project lock makes concurrent moves serialize without duplicate ranks.
    const allSections = await tx.select().from(sections).where(eq(sections.projectId, projectId)).orderBy(asc(sections.order), asc(sections.id)).for('update');
    if (kind === 'section') {
      if (!allSections.some((s) => s.id === id)) throw new Error('Section not in project.');
      const ordered = allSections.filter((s) => s.id !== id).map((s) => s.id);
      ordered.splice(Math.min(position, ordered.length), 0, id);
      for (let i = 0; i < ordered.length; i++) await tx.update(sections).set({ order: i }).where(eq(sections.id, ordered[i]));
      return;
    }
    if (!['task', 'subtask'].includes(kind)) throw new Error('Invalid item type.');
    const [task] = await tx.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).limit(1);
    if (!task) throw new Error('Task not in project.');
    if (kind === 'task' && task.parentId !== null) throw new Error('Move sub-tasks from their parent task.');
    if (kind === 'task' && target !== null && !allSections.some((s) => s.id === target)) throw new Error('Destination section not in project.');
    if (kind === 'subtask' && (target === null || task.parentId !== target)) throw new Error('Sub-task not in this parent.');
    const peers = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.projectId, projectId), kind === 'subtask' ? eq(tasks.parentId, target!) : and(isNull(tasks.parentId), target === null ? isNull(tasks.sectionId) : eq(tasks.sectionId, target)))).orderBy(asc(tasks.order), asc(tasks.id)).for('update');
    const ordered = peers.filter((t) => t.id !== id).map((t) => t.id);
    ordered.splice(Math.min(position, ordered.length), 0, id);
    for (let i = 0; i < ordered.length; i++) await tx.update(tasks).set({ order: i, ...(kind === 'task' ? { sectionId: target } : {}), updatedAt: new Date() }).where(eq(tasks.id, ordered[i]));
  });
}
