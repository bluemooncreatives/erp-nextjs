'use client';

// The board view - `project::project.board`.
//
// The Vue board was columns of draggable cards. This is columns of cards that
// move by naming their destination: `react-dnd` cannot be operated from a
// keyboard without building a parallel control anyway, and a select is that
// control. It reaches the same `moveTask` the drag handler did.
//
// The port previously rendered the list view's tables in a two-column grid and
// called that a board, so there were no columns, no cards and no moves.

import Link from 'next/link';
import { Card } from '@/components/erp/page';
import { Badge } from '@/components/erp/badge';
import { ActionButton } from '@/components/erp/submit-button';
import { SubmitButton } from '@/components/erp/submit-button';
import { EmptyState } from '@/components/erp/page';
import { route } from '@/lib/routes';
import { moveTaskToSection, storeTask, toggleTaskComplete } from '../../actions';
import { SectionName } from './section-name';
import { useState, useTransition } from 'react';
import { reorderProjectItem } from '../../order-actions';
import { OrderControls } from '../../order-controls';

export type BoardTask = {
  id: number;
  uuid: string | null;
  name: string | null;
  completed: number;
  createdByName: string | null;
  fields?: { name: string; value: string }[];
};

export type BoardColumn = {
  id: number | null;
  name: string;
  deletable: boolean;
  tasks: BoardTask[];
};

export function TaskBoard({
  projectId,
  columns,
}: {
  projectId: number;
  columns: BoardColumn[];
}) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const drop = (event: React.DragEvent, target: number | null, position: number) => {
    event.preventDefault(); event.stopPropagation();
    const id = Number(event.dataTransfer.getData('text/plain'));
    if (!columns.some((c) => c.tasks.some((t) => t.id === id))) return;
    start(async () => {
      const data = new FormData();
      Object.entries({ project_id: projectId, kind: 'task', id, target: target ?? '', position }).forEach(([k, v]) => data.set(k, String(v)));
      const result = await reorderProjectItem(data); setError(result.error ?? '');
    });
  };
  return (<>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    <div aria-busy={pending} className="minimal-scrollbar flex gap-4 overflow-x-auto pb-2">
      {columns.map((column, columnIndex) => (
        <div key={column.id ?? 'none'} className="w-80 shrink-0" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, column.id, column.tasks.length)}>
          {column.id !== null ? <OrderControls projectId={projectId} kind="section" id={column.id} position={columnIndex} count={columns.filter((c) => c.id !== null).length} /> : null}
          <Card
            title={
              <SectionName
                sectionId={column.id}
                projectId={projectId}
                name={column.name}
                count={column.tasks.length}
                editable={column.deletable}
              />
            }
          >
            <div className="space-y-3">
              {column.tasks.length === 0 ? (
                <EmptyState message="Nothing here yet." />
              ) : (
                column.tasks.map((task, index) => (
                  <article
                    key={task.id}
                    draggable={!pending}
                    onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(task.id)); event.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => drop(event, column.id, index)}
                    className="border-border bg-card rounded-xl border p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={route('task.show', { uuid: task.uuid })}
                        className="text-foreground hover:text-primary text-sm font-medium"
                      >
                        {task.name}
                      </Link>
                      <Badge
                        color={task.completed === 1 ? 'success' : 'warning'}
                        size="sm"
                      >
                        {task.completed === 1 ? 'Complete' : 'Open'}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground mt-1 text-xs">
                      {task.createdByName ?? '-'}
                    </p>

                    {task.fields?.filter((f) => f.value).map((f) => <p key={f.name} className="mt-1 text-xs"><span className="text-muted-foreground">{f.name}: </span>{f.value}</p>)}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <OrderControls projectId={projectId} kind="task" id={task.id} target={column.id} position={index} count={column.tasks.length} />
                      <form action={toggleTaskComplete}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <input
                          type="hidden"
                          name="value"
                          value={task.completed === 1 ? 0 : 1}
                        />
                        <ActionButton variant="primary">
                          {task.completed === 1 ? 'Reopen' : 'Complete'}
                        </ActionButton>
                      </form>

                      {/* Submits on change, and still works as a form with a
                          button when scripting is off. */}
                      <form action={moveTaskToSection} className="flex items-center gap-1">
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <select
                          name="section_id"
                          defaultValue={column.id == null ? '' : String(column.id)}
                          aria-label={`Move ${task.name ?? 'task'} to another section`}
                          className="border-border h-8 rounded-lg border bg-transparent px-2 text-xs"
                        >
                          {columns.map((target) => (
                            <option
                              key={target.id ?? 'none'}
                              value={target.id == null ? '' : String(target.id)}
                            >
                              {target.name}
                            </option>
                          ))}
                        </select>
                        <SubmitButton size="sm" variant="outline">
                          Move
                        </SubmitButton>
                      </form>
                    </div>
                  </article>
                ))
              )}
            </div>

            <form action={storeTask} className="mt-4 flex items-center gap-2">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="section_id" value={column.id ?? ''} />
              <input
                type="text"
                name="name"
                required
                placeholder="Add a task"
                className="border-border h-9 flex-1 rounded-lg border bg-transparent px-3 text-sm"
              />
              <SubmitButton size="sm">Add</SubmitButton>
            </form>
          </Card>
        </div>
      ))}
    </div></>
  );
}
