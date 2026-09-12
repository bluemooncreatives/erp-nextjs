// Events - port of Modules/Attendance EventController@index / @edit
// (`attendance::events.index`, which rendered the list and the form together).

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { listEvents, findEvent, normalRoles, listToDos } from '@/lib/hr/events';
import { dateConvert } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { destroyEvent, markToDoComplete, destroyToDo } from './actions';
import { EventForm, ToDoForm } from './forms';

export const metadata: Metadata = { title: 'Events' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const [events, roles, todos, editing] = await Promise.all([
    listEvents(),
    normalRoles(),
    listToDos(),
    sp.edit ? findEvent(Number(sp.edit)) : Promise.resolve(null),
  ]);

  const rows = await Promise.all(
    events.map(async (event) => ({
      event,
      fromLabel: await dateConvert(event.fromDate),
      toLabel: event.toDate ? await dateConvert(event.toDate) : '-',
    })),
  );

  const todoRows = await Promise.all(
    todos.map(async (todo) => ({ todo, dateLabel: await dateConvert(todo.date) })),
  );

  return (
    <>
      <PageHeader title="Events" breadcrumb={[{ label: 'Events' }]} />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title={`Events (${rows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'ID' },
                { label: 'Title' },
                { label: 'For Whom' },
                { label: 'Location' },
                { label: 'From' },
                { label: 'To' },
                { label: 'Action' },
              ]}
              isEmpty={rows.length === 0}
              empty="No events."
            >
              {rows.map((row, index) => (
                <Tr key={row.event.id}>
                  <Td>{index + 1}</Td>
                  <Td className="font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      {row.event.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assetUrl(row.event.image) ?? ''}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : null}
                      {row.event.title}
                    </span>
                  </Td>
                  <Td>{row.event.forWhom}</Td>
                  <Td>{row.event.location}</Td>
                  <Td>{row.fromLabel}</Td>
                  <Td>{row.toLabel}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${ROUTES['events.index']}?edit=${row.event.id}`}
                        className="text-xs font-medium text-primary hover:text-primary"
                      >
                        Edit
                      </Link>
                      <form action={destroyEvent}>
                        <input type="hidden" name="id" value={row.event.id} />
                        <ActionButton confirm="Delete this event?">Delete</ActionButton>
                      </form>
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          <Card title={`To Do (${todoRows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Title' },
                { label: 'Date' },
                { label: 'Status' },
                { label: 'Action' },
              ]}
              isEmpty={todoRows.length === 0}
              empty="Nothing on the list."
            >
              {todoRows.map((row) => (
                <Tr key={row.todo.id}>
                  <Td className="font-medium text-foreground">
                    {row.todo.title}
                  </Td>
                  <Td>{row.dateLabel}</Td>
                  <Td>
                    <Badge color={row.todo.status === 1 ? 'success' : 'warning'} size="sm">
                      {row.todo.status === 1 ? 'Complete':'Pending'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {row.todo.status !== 1 ? (
                        <form action={markToDoComplete}>
                          <input type="hidden" name="id" value={row.todo.id} />
                          <ActionButton variant="primary">Complete</ActionButton>
                        </form>
                      ) : null}
                      <form action={destroyToDo}>
                        <input type="hidden" name="id" value={row.todo.id} />
                        <ActionButton confirm="Delete this to-do?">Delete</ActionButton>
                      </form>
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={editing ? 'Edit Event':'Add Event'}>
            <EventForm
              event={
                editing
                  ? {
                      id: editing.id,
                      title: editing.title,
                      forWhom: editing.forWhom,
                      location: editing.location,
                      description: editing.description ?? '',
                      fromDate: editing.fromDate ?? '',
                      toDate: editing.toDate ?? '',
                    }
                  : null
              }
              roles={roles.map((r) => ({ value: r.name, label: r.name }))}
            />
            {editing ? (
              <div className="pt-4">
                <Link
                  href={ROUTES['events.index']}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Link>
              </div>
            ) : null}
          </Card>

          <Card title="Add To Do">
            <ToDoForm />
          </Card>
        </div>
      </div>
    </>
  );
}
