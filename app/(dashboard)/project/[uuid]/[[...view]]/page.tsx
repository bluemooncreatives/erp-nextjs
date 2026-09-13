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
import { projectAttachments } from '@/lib/project/attachments';
import { assetUrl } from '@/lib/paths';
import { CustomFields } from '../../custom-fields';
import { projectFields, projectFieldValues, requireProjectAccess } from '@/lib/project/fields';

export const metadata: Metadata = { title: 'Project' };

const VIEWS = ['list', 'board', 'files', 'conversation'] as const;

export default async function ProjectShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string; view?: string[] }>;
  searchParams: Promise<{ sort?: string; completed?: string }>;
}) {
  const user = await requireUser();
  const { uuid, view } = await params;

  const project = await findProjectByUuid(uuid);
  if (!project) notFound();
  await requireProjectAccess(project.id);

  // `$blade = $view ?: $model->default_view`, restricted to the known views.
  const requested = view?.[0];
  const active =
    requested && (VIEWS as readonly string[]).includes(requested)
      ? requested
      : project.defaultView || 'list';

  const board = await projectBoard(project.id);
  const filter = await searchParams;
  const definitions = (await projectFields(project.id)).filter((r) => r.link.visibility === 1);
  const values = await projectFieldValues(project.id);
  const fieldValue = (taskId: number, fieldId: number) => {
    const definition = definitions.find((r) => r.field.id === fieldId);
    const value = values.find((r) => r.value.taskId === taskId && r.value.fieldId === fieldId)?.value;
    if (!definition || !value) return '';
    const type = definition.field.type;
    if (type === 'number') return value.number ?? '';
    if (type === 'date') return value.date?.toISOString().slice(0, 10) ?? '';
    if (type === 'dropdown') return definition.options.find((o) => o.id === value.optionId)?.option ?? '';
    if (type === 'user_id') return board.members.find((m) => m.id === value.userId)?.name ?? '';
    return value.text ?? '';
  };
  if (filter.completed === '0' || filter.completed === '1') board.tasks = board.tasks.filter((r) => r.task.completed === Number(filter.completed));
  if (filter.sort === 'name') board.tasks.sort((a, b) => (a.task.name ?? '').localeCompare(b.task.name ?? ''));
  else if (definitions.some((r) => r.field.id === Number(filter.sort))) {
    const fieldId = Number(filter.sort);
    board.tasks.sort((a, b) => {
      const av = fieldValue(a.task.id, fieldId), bv = fieldValue(b.task.id, fieldId);
      return typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
    });
  }
  const preference = await projectPreference(project.id, user.id);

  // The Files view lists what is attached across the project's tasks; the
  // attaching itself belongs to a task, as it did in the Vue board.
  const attachments = (await projectAttachments(project.id)).map((file) => ({
    ...file,
    when: toDateTimeString(file.createdAt) ?? '',
  }));

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

      <details className="mb-5 rounded-lg border border-border p-4"><summary className="cursor-pointer font-medium">Manage custom fields</summary><CustomFields projectId={project.id} /></details>
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">Sort tasks<select name="sort" defaultValue={filter.sort ?? ''} className="ms-2 rounded border border-border bg-background p-2"><option value="">Manual order</option><option value="name">Alphabetical</option>{definitions.map((r) => <option key={r.field.id} value={r.field.id}>{r.field.name}</option>)}</select></label>
        <label className="text-sm">Status<select name="completed" defaultValue={filter.completed ?? ''} className="ms-2 rounded border border-border bg-background p-2"><option value="">All</option><option value="0">Open</option><option value="1">Complete</option></select></label>
        <SubmitButton size="sm">Apply</SubmitButton>
      </form>
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
            <Card title={`Files (${attachments.length})`} bodyClassName="">
              <DataTable
                columns={[{ label: 'File' }, { label: 'Task' }, { label: 'Added' }]}
                isEmpty={attachments.length === 0}
                empty="Nothing has been attached to this project's tasks yet."
              >
                {attachments.map((file) => (
                  <Tr key={file.id}>
                    <Td className="font-medium">
                      <a
                        href={assetUrl(file.filename) ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary"
                      >
                        {file.userFilename ?? 'File'}
                      </a>
                    </Td>
                    <Td>
                      {file.task?.uuid ? (
                        <Link
                          href={route('task.show', { uuid: file.task.uuid })}
                          className="text-primary hover:text-primary"
                        >
                          {file.task.name}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </Td>
                    <Td>{file.when}</Td>
                  </Tr>
                ))}
              </DataTable>
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
                  fields: definitions.map((r) => ({ name: r.field.name ?? 'Field', value: String(fieldValue(row.task.id, r.field.id)) })),
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
                        ...definitions.map((r) => ({ label: r.field.name ?? 'Field' })),
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
                          {definitions.map((r) => <Td key={r.field.id}>{String(fieldValue(row.task.id, r.field.id)) || '-'}</Td>)}
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
