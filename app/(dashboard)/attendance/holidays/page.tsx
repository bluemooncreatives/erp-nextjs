// Holidays - port of HolidayController.
// A holiday is either a single date or a range stored as "from,to".

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listHolidays } from '@/lib/hr/leave';
import { dateConvert } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { removeHoliday } from '../../leave/actions';
import { HolidayForm } from './holiday-form';

export const metadata: Metadata = { title: 'Holiday Setup' };

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await authorize('holidays.index');
  const sp = await searchParams;

  const year = sp.year ? Number(sp.year) : undefined;
  const rows = await listHolidays(year);

  const [canCreate, canDelete] = await Promise.all([
    can('holidays.store'),
    can('holidays.destroy'),
  ]);

  const holidayRows = await Promise.all(
    rows.map(async (h) => {
      const [from, to] = String(h.date ?? '').split(',');
      return {
        ...h,
        fromLabel: from ? await dateConvert(from) : '-',
        toLabel: to ? await dateConvert(to) : null,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Holiday Setup"
        breadcrumb={[{ label: 'Leave' }, { label: 'Holiday Setup' }]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <HolidayForm />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8' : 'col-span-12'}>
          <Card title={`Holidays (${holidayRows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Name' },
                { label: 'Type' },
                { label: 'From' },
                { label: 'To' },
                { label: 'Year' },
                { label: '' },
              ]}
              isEmpty={holidayRows.length === 0}
              empty="No holidays configured."
            >
              {holidayRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {row.name}
                  </Td>
                  <Td>
                    <Badge size="sm" color={row.type === 1 ? 'primary' : 'light'}>
                      {row.type === 1 ? 'Range' : 'Single day'}
                    </Badge>
                  </Td>
                  <Td>{row.fromLabel}</Td>
                  <Td>{row.toLabel ?? '-'}</Td>
                  <Td>{row.year}</Td>
                  <Td>
                    {canDelete ? (
                      <form action={removeHoliday}>
                        <input type="hidden" name="id" value={row.id} />
                        <ActionButton confirm={`Delete holiday "${row.name}"?`}>
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
