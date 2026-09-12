// Task detail - port of TaskController@show (`project::task.show`), with the
// comment thread, tags, likes and sub-tasks the Vue panel rendered.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findTaskByUuid, findProject } from '@/lib/project/repository';
import { toDateTimeString } from '@/lib/php-date';
import { route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton, SubmitButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import {
  commentOnTask,
  destroyTaskComment,
  pinComment,
  toggleTaskComplete,
  toggleTaskLike,
  storeTask,
  storeTag,
  removeTag,
  updateTaskName,
} from '../../project/actions';

export const metadata: Metadata = { title: 'Task' };

export default async function TaskShowPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  await requireUser();
  const { uuid } = await params;

  const record = await findTaskByUuid(uuid);
  if (!record) notFound();

  const { task, subTasks, comments, tags, likes } = record;
  const project = task.projectId ? await findProject(task.projectId) : null;

  return (
    <>
      <PageHeader
        title={task.name ?? 'Task'}
        breadcrumb={[
          { label: 'Projects', href: route('project.index') },
          ...(project
            ? [
                {
                  label: project.name ?? '',
                  href: route('project.show', { uuid: project.uuid }),
                },
              ]
            : []),
          { label: 'Task' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <form action={toggleTaskComplete}>
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="project_id" value={task.projectId ?? ''} />
              <input type="hidden" name="value" value={task.completed === 1 ? 0 : 1} />
              <SubmitButton size="sm" variant={task.completed === 1 ? 'outline' : 'primary'}>
                {task.completed === 1 ? 'Reopen' : 'Mark complete'}
              </SubmitButton>
            </form>
            <form action={toggleTaskLike}>
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="uuid" value={uuid} />
              <input type="hidden" name="value" value="1" />
              <SubmitButton size="sm" variant="outline">
                {`Like (${likes})`}
              </SubmitButton>
            </form>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card title="Task">
            <form action={updateTaskName} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="project_id" value={task.projectId ?? ''} />
              <input
                type="text"
                name="name"
                defaultValue={task.name ?? ''}
                className="h-10 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <SubmitButton size="sm">Rename</SubmitButton>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge color={task.completed === 1 ? 'success' : 'warning'} size="sm">
                {task.completed === 1 ? 'Complete' : 'Open'}
              </Badge>
              {task.completedAt ? (
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {`Completed ${toDateTimeString(task.completedAt)}`}
                </span>
              ) : null}
            </div>

            {task.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                {task.description}
              </p>
            ) : null}
          </Card>

          <Card title={`Sub-tasks (${subTasks.length})`} bodyClassName="">
            <DataTable
              columns={[{ label: 'Task' }, { label: 'Status' }]}
              isEmpty={subTasks.length === 0}
              empty="No sub-tasks."
            >
              {subTasks.map((sub) => (
                <Tr key={sub.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    <Link
                      href={route('task.show', { uuid: sub.uuid })}
                      className="text-brand-500 hover:text-brand-600"
                    >
                      {sub.name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge color={sub.completed === 1 ? 'success' : 'warning'} size="sm">
                      {sub.completed === 1 ? 'Complete' : 'Open'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </DataTable>

            <form action={storeTask} className="flex flex-wrap items-center gap-2 p-4 sm:p-6">
              <input type="hidden" name="project_id" value={task.projectId ?? ''} />
              <input type="hidden" name="section_id" value={task.sectionId ?? ''} />
              <input type="hidden" name="parent_id" value={task.id} />
              <input
                type="text"
                name="name"
                required
                placeholder="Add a sub-task"
                className="h-10 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <SubmitButton size="sm">Add</SubmitButton>
            </form>
          </Card>

          <Card title={`Activity (${comments.length})`}>
            <form action={commentOnTask} className="space-y-3">
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="uuid" value={uuid} />
              <textarea
                name="comment"
                rows={3}
                required
                placeholder="Write a comment"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <div className="flex justify-end">
                <SubmitButton size="sm">Comment</SubmitButton>
              </div>
            </form>

            <ul className="mt-6 space-y-4">
              {comments.map((row) => (
                <li
                  key={row.comment.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {row.authorName ?? 'Unknown'}
                      {row.comment.event ? (
                        <span className="ml-2 text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                          {row.comment.event.replace(/_/g, ' ')}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-2">
                      <form action={pinComment}>
                        <input type="hidden" name="comment_id" value={row.comment.id} />
                        <input type="hidden" name="uuid" value={uuid} />
                        <input
                          type="hidden"
                          name="pin"
                          value={row.comment.pinTop === 1 ? 0 : 1}
                        />
                        <ActionButton variant="outline">
                          {row.comment.pinTop === 1 ? 'Unpin' : 'Pin'}
                        </ActionButton>
                      </form>
                      <form action={destroyTaskComment}>
                        <input type="hidden" name="comment_id" value={row.comment.id} />
                        <input type="hidden" name="uuid" value={uuid} />
                        <ActionButton confirm="Delete this comment?">Delete</ActionButton>
                      </form>
                    </div>
                  </div>
                  {row.comment.comment ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                      {row.comment.comment}
                    </p>
                  ) : null}
                  {row.comment.oldValue ? (
                    <p className="mt-1 text-theme-xs text-gray-400 line-through">
                      {row.comment.oldValue}
                    </p>
                  ) : null}
                  <p className="mt-2 text-theme-xs text-gray-400">
                    {toDateTimeString(row.comment.createdAt)}
                  </p>
                </li>
              ))}
              {comments.length === 0 ? (
                <li className="text-sm text-gray-500 dark:text-gray-400">No activity yet.</li>
              ) : null}
            </ul>
          </Card>
        </div>

        <Card title="Tags">
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.id}>
                <form action={removeTag} className="inline-flex items-center gap-1">
                  <input type="hidden" name="task_id" value={task.id} />
                  <input type="hidden" name="tag_id" value={tag.id} />
                  <input type="hidden" name="uuid" value={uuid} />
                  <Badge color="info" size="sm">
                    {tag.name}
                  </Badge>
                  <ActionButton>x</ActionButton>
                </form>
              </li>
            ))}
            {tags.length === 0 ? (
              <li className="text-sm text-gray-500 dark:text-gray-400">No tags.</li>
            ) : null}
          </ul>

          <form action={storeTag} className="mt-5 flex flex-wrap items-center gap-2">
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="uuid" value={uuid} />
            <input
              type="text"
              name="name"
              required
              placeholder="Add a tag"
              className="h-10 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <SubmitButton size="sm">Add</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
