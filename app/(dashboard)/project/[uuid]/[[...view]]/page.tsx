// Project screen - port of ProjectController@show, which picked one of the
// `project::project.show{blade}` views (list, board, files, conversation).
//
// The PHP shipped a Vue board with drag-and-drop reordering. The data and the
// writes are the same here; the board moves a card by naming its destination
// rather than by dragging, which is also the only form of it a keyboard can
// operate.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import {
  findProjectByUuid,
  projectBoard,
  projectPreference,
} from '@/lib/project/repository';
import { dateConvert } from '@/lib/settings';
import { toDateTimeString } from '@/lib/php-date';
import { route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton, SubmitButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import {
  storeSection,
  destroySection,
  storeTask,
  toggleTaskComplete,
  destroyTask,
  commentOnProject,
  destroyProjectComment,
  removeProjectMember,
  destroyProject,
  changeProjectView,
} from '../../actions';
import { ProjectSettingsForm, ShareProjectForm } from '../../forms';
import { SelectControl } from '@/components/erp/select-control';
import { Phrase } from '@/context/TranslationContext';
import { SectionName } from './section-name';
import { CommentBody } from './comment-body';
import { ProjectPreferences } from './project-preferences';
import { TaskBoard } from './task-board';

export const metadata: Metadata = { title: 'Project' };

const VIEWS = ['list', 'board', 'files', 'conversation'] as const;

export default async function ProjectShowPage({
  params,
}: {
  params: Promise<{ uuid: string; view?: string[] }>;
}) {
  const user = await requireUser();
  const { uuid, view } = await params;

  const project = await findProjectByUuid(uuid);
  if (!project) notFound();

  // `$blade = $view ?: $model->default_view`, restricted to the known views.
  const requested = view?.[0];
  const active =
    requested && (VIEWS as readonly string[]).includes(requested)
      ? requested
      : project.defaultView || 'list';

  const board = await projectBoard(project.id);
  const preference = await projectPreference(project.id, user.id);

  const tasksBySection = new Map<number | null, typeof board.tasks>();
  for (const row of board.tasks) {
    const key = row.task.sectionId ?? null;
    const list = tasksBySection.get(key) ?? [];
    list.push(row);
    tasksBySection.set(key, list);
  }

  const comments = await Promise.all(
    board.comments.map(async (row) => ({
      ...row,
      when: toDateTimeString(row.comment.createdAt) ?? '',
    })),
  );

  const dueLabel = project.dueDate ? await dateConvert(project.dueDate) : '-';
  const sectionGroups = [
    ...board.sections.map((section) => ({
      id: section.id as number | null,
      name: section.name ?? 'Untitled',
      deletable: true,
    })),
    // Tasks created before any section exists hang off the project directly.
    ...(tasksBySection.has(null)
      ? [{ id: null as number | null, name: 'Unsectioned', deletable: false }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={project.name ?? 'Project'}
        breadcrumb={[
          { label: 'Projects', href: route('project.index') },
          { label: project.name ?? '' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProjectPreferences
              projectId={project.id}
              colour={preference?.color ?? null}
              favourite={preference?.favourite === 1}
            />
            {VIEWS.map((name) => (
              <Link
                key={name}
                href={route('project.show', { uuid, view: name === 'list' ? null : name })}
                className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                  active === name
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted  '
                }`}
              >
                {name}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {active === 'conversation' ? (
            <Card title={`Conversation (${comments.length})`}>
              <form action={commentOnProject} className="space-y-3">
                <input type="hidden" name="project_id" value={project.id} />
                <textarea
                  name="comment"
                  rows={3}
                  required
                  placeholder="Write a comment"
                  className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
                <div className="flex justify-end">
                  <SubmitButton size="sm">Comment</SubmitButton>
                </div>
              </form>

              <ul className="mt-6 space-y-4">
                {comments.map((row) => (
                  <li
                    key={row.comment.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {row.authorName ?? 'Unknown'}
                        {row.comment.pinTop === 1 ? (
                          <span className="ms-2">
                            <Badge color="info" size="sm">
                              Pinned
                            </Badge>
                          </span>
                        ) : null}
                      </p>
                      <form action={destroyProjectComment}>
                        <input type="hidden" name="comment_id" value={row.comment.id} />
                        <input type="hidden" name="project_id" value={project.id} />
                        <ActionButton confirm="Delete this comment?"><Phrase>Delete</Phrase></ActionButton>
                      </form>
                    </div>
                    <CommentBody
                      commentId={row.comment.id}
                      projectId={project.id}
                      comment={row.comment.comment ?? ''}
                      editable={row.comment.createdBy === user.id}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">{row.when}</p>
                  </li>
                ))}
                {comments.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No comments yet.
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}

          {active === 'files' ? (
            <Card title="Files">
              <p className="text-sm text-muted-foreground">
                Files are attached to individual tasks - open a task to see and add
                attachments.
              </p>
            </Card>
          ) : null}

          {active === 'board' ? (
            <TaskBoard
              projectId={project.id}
              columns={sectionGroups.map((section) => ({
                id: section.id,
                name: section.name,
                deletable: section.deletable,
                tasks: (tasksBySection.get(section.id) ?? []).map((row) => ({
                  id: row.task.id,
                  uuid: row.task.uuid,
                  name: row.task.name,
                  completed: row.task.completed,
                  createdByName: row.createdByName,
                })),
              }))}
            />
          ) : null}

          {active === 'list' ? (
            <div className="space-y-5">
              {sectionGroups.map((section) => {
                const rows = tasksBySection.get(section.id) ?? [];
                return (
                  <Card
                    key={section.id ?? 'none'}
                    title={
                      <SectionName
                        sectionId={section.id}
                        projectId={project.id}
                        name={section.name}
                        count={rows.length}
                        editable={section.deletable}
                      />
                    }
                    bodyClassName=""
                    actions={
                      section.deletable ? (
                        <form action={destroySection}>
                          <input type="hidden" name="section_id" value={section.id ?? ''} />
                          <input type="hidden" name="project_id" value={project.id} />
                          <ActionButton confirm="Delete this section and its tasks?">
                            Delete section
                          </ActionButton>
                        </form>
                      ) : null
                    }
                  >
                    <DataTable
                      columns={[
                        { label: 'Task' },
                        { label: 'Created by' },
                        { label: 'Status' },
                        { label: 'Action' },
                      ]}
                      isEmpty={rows.length === 0}
                      empty="No tasks in this section."
                    >
                      {rows.map((row) => (
                        <Tr key={row.task.id}>
                          <Td className="font-medium text-foreground">
                            <Link
                              href={route('task.show', { uuid: row.task.uuid })}
                              className="text-primary hover:text-primary"
                            >
                              {row.task.name}
                            </Link>
                          </Td>
                          <Td>{row.createdByName ?? '-'}</Td>
                          <Td>
                            <Badge
                              color={row.task.completed === 1 ? 'success' : 'warning'}
                              size="sm"
                            >
                              {row.task.completed === 1 ? 'Complete':'Open'}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <form action={toggleTaskComplete}>
                                <input type="hidden" name="task_id" value={row.task.id} />
                                <input type="hidden" name="project_id" value={project.id} />
                                <input
                                  type="hidden"
                                  name="value"
                                  value={row.task.completed === 1 ? 0 : 1}
                                />
                                <ActionButton variant="primary">
                                  {row.task.completed === 1 ? 'Reopen':'Complete'}
                                </ActionButton>
                              </form>
                              <form action={destroyTask}>
                                <input type="hidden" name="task_id" value={row.task.id} />
                                <input type="hidden" name="project_id" value={project.id} />
                                <ActionButton confirm="Delete this task?"><Phrase>Delete</Phrase></ActionButton>
                              </form>
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </DataTable>

                    <form
                      action={storeTask}
                      className="flex flex-wrap items-center gap-2 p-4 sm:p-6"
                    >
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="section_id" value={section.id ?? ''} />
                      <input
                        type="text"
                        name="name"
                        required
                        placeholder="Add a task"
                        className="h-10 flex-1 rounded-lg border border-border bg-transparent px-3 text-sm"
                      />
                      <SubmitButton size="sm">Add task</SubmitButton>
                    </form>
                  </Card>
                );
              })}

              <Card title="Add Section">
                <form action={storeSection} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Section name"
                    className="h-10 flex-1 rounded-lg border border-border bg-transparent px-3 text-sm"
                  />
                  <SubmitButton size="sm">Add section</SubmitButton>
                </form>
              </Card>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card title="Project" desc={`Due ${dueLabel}`}>
            <ProjectSettingsForm
              project={{
                id: project.id,
                name: project.name ?? '',
                description: project.description ?? '',
                dueDate: project.dueDate ?? '',
                userId: project.userId ?? user.id,
              }}
              members={board.members.map((m) => ({ value: m.id, label: m.name }))}
            />

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <form action={changeProjectView} className="flex items-center gap-2">
                <input type="hidden" name="project_id" value={project.id} />
                <SelectControl
                  name="view"
                  size="sm"
                  defaultValue={project.defaultView}
                  aria-label="Default view"
                  options={VIEWS.map((v) => ({ value: v, label: v }))}
                  className="w-32 capitalize"
                />
                <ActionButton variant="outline">Set default view</ActionButton>
              </form>

              <form action={destroyProject}>
                <input type="hidden" name="project_id" value={project.id} />
                <ActionButton confirm="Delete this project and everything in it?">
                  Delete project
                </ActionButton>
              </form>
            </div>
          </Card>

          <Card title={`Members (${board.members.length})`} bodyClassName="">
            <DataTable
              columns={[{ label: 'Name' }, { label: 'Email' }, { label: '' }]}
              isEmpty={board.members.length === 0}
              empty="No members."
            >
              {board.members.map((member) => (
                <Tr key={member.id}>
                  <Td className="font-medium text-foreground">
                    {member.name}
                  </Td>
                  <Td>{member.email ?? '-'}</Td>
                  <Td>
                    {member.id !== project.userId ? (
                      <form action={removeProjectMember}>
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="user_id" value={member.id} />
                        <ActionButton confirm="Remove this member?"><Phrase>Remove</Phrase></ActionButton>
                      </form>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </DataTable>

            <div className="p-4 sm:p-6">
              <ShareProjectForm projectId={project.id} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
