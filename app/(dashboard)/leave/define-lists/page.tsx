// Leave define - port of LeaveDefineController@index.
// Sets how many days of each leave type a role is entitled to.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles } from '@/lib/db/schema';
import { leaveTypeRepository, listLeaveDefines } from '@/lib/hr/leave';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { removeLeaveDefine } from '../actions';
import { LeaveDefineForm } from './leave-define-form';

export const metadata: Metadata = { title: 'Leave Define' };

export default async function LeaveDefinePage() {
  await authorize('leave_define.index');

  const [rows, roleRows, types] = await Promise.all([
    listLeaveDefines(),
    db.select().from(roles).orderBy(roles.id),
    leaveTypeRepository.all(),
  ]);

  const [canCreate, canDelete] = await Promise.all([
    can('leave_define.store'),
    can('leave_define.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Leave Define"
        breadcrumb={[{ label: 'Leave' }, { label: 'Leave Define' }]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <LeaveDefineForm
              roles={roleRows.map((r) => ({ value: r.id, label: r.name }))}
              leaveTypes={types.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8' : 'col-span-12'}>
          <Card title={`Definitions (${rows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Role' },
                { label: 'Leave Type' },
                { label: 'Total Days' },
                { label: 'Max Carry Forward' },
                { label: 'Carry Forward' },
                { label: 'Year' },
                { label: '' },
              ]}
              isEmpty={rows.length === 0}
              empty="No leave definitions yet."
            >
              {rows.map((row) => (
                <Tr key={row.define.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {row.roleName ?? '-'}
                  </Td>
                  <Td>{row.leaveTypeName ?? '-'}</Td>
                  <Td>{row.define.totalDays}</Td>
                  <Td>{row.define.maxForward}</Td>
                  <Td>
                    <Badge
                      size="sm"
                      color={row.define.balanceForward === 1 ? 'success' : 'light'}
                    >
                      {row.define.balanceForward === 1 ? 'Yes' : 'No'}
                    </Badge>
                  </Td>
                  <Td>{row.define.year ?? '-'}</Td>
                  <Td>
                    {canDelete ? (
                      <form action={removeLeaveDefine}>
                        <input type="hidden" name="id" value={row.define.id} />
                        <ActionButton confirm="Delete this leave definition?">
                          Delete
                        </ActionButton>
                      </form>
                    ) : (
                      '-'
                    )}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>
      </div>
    </>
  );
}
