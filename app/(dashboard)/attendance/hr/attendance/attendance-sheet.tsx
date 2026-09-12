'use client';

// The daily attendance sheet - port of `attendance::attendance.index`.

import { useActionState, useState } from 'react';
import { Card, EmptyState } from '@/components/erp/page';
import { FormAlert } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { storeAttendance, type LeaveFormState } from '../../../leave/actions';

const INITIAL: LeaveFormState = {};

/** The marks `attendances.attendance` accepts. */
const MARKS = [
  { value: 'P', label: 'Present' },
  { value: 'A', label: 'Absent' },
  { value: 'L', label: 'Late' },
  { value: 'H', label: 'Half day' },
  { value: 'F', label: 'Holiday' },
];

export function AttendanceSheet({
  date,
  roleId,
  staff,
}: {
  date: string;
  roleId: number | null;
  staff: Array<{
    id: number;
    name: string;
    email: string | null;
    mark: string;
    note: string | null;
  }>;
}) {
  const [state, formAction] = useActionState(storeAttendance, INITIAL);
  const [rows, setRows] = useState(staff);

  if (!roleId) {
    return (
      <Card title="Attendance">
        <EmptyState message="Choose a role and a date to mark attendance." />
      </Card>
    );
  }

  const patch = (id: number, value: Partial<(typeof staff)[number]>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...value } : r)));

  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="role_id" value={roleId} />

      <Card title={`Attendance for ${date}`} bodyClassName="">
        <div className="px-4 pt-4 sm:px-6">
          <FormAlert variant="error" message={state.error} />
          <FormAlert variant="success" message={state.success} />
        </div>

        <DataTable
          columns={[{ label: 'Staff' }, { label: 'Attendance' }, { label: 'Note' }]}
          isEmpty={rows.length === 0}
          empty="No active users in this role."
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>
                <p className="font-medium text-gray-700 dark:text-gray-300">{row.name}</p>
                <p className="text-theme-xs text-gray-400">{row.email}</p>
                <input type="hidden" name="user_id" value={row.id} />
              </Td>
              <Td>
                <select
                  name="attendance"
                  value={row.mark}
                  onChange={(e) => patch(row.id, { mark: e.target.value })}
                  className="h-9 w-36 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  {MARKS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <input
                  type="text"
                  name="note"
                  value={row.note ?? ''}
                  onChange={(e) => patch(row.id, { note: e.target.value })}
                  className="h-9 w-64 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </Td>
            </Tr>
          ))}
        </DataTable>

        {rows.length > 0 ? (
          <div className="p-4 sm:p-6">
            <SubmitButton>Save Attendance</SubmitButton>
          </div>
        ) : null}
      </Card>
    </form>
  );
}
