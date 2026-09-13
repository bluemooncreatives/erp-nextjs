// Holidays - port of HolidayController.
// A holiday is either a single date or a range stored as "from,to".

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listHolidays } from '@/lib/hr/leave';
import { dateConvert } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { removeHoliday } from '../../leave/actions';
import { ReportSummary } from '@/components/erp/report-summary';
import { CalendarDays, CalendarRange, Sun } from 'lucide-react';
import { HolidayForm } from './holiday-form';
import { Phrase } from '@/context/TranslationContext';

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

  // A range holiday covers more than one day, so a count of rows is not a
  // count of days off - both figures are worth showing.
  const rangeCount = holidayRows.filter((row) => row.type === 1).length;
  const yearCount = new Set(holidayRows.map((row) => row.year).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Holiday Setup"
        breadcrumb={[{ label: 'Leave' }, { label: 'Holiday Setup' }]}
      />

      <ReportSummary
        figures={[
          {
            label: 'Holidays',
            value: holidayRows.length,
            detail: year ? `Configured for ${year}` : 'Configured in total',
            icon: CalendarDays,
          },
          { label: 'Single days', value: holidayRows.length - rangeCount, detail: 'One date each', icon: Sun },
          { label: 'Ranges', value: rangeCount, detail: 'Spanning several days', icon: CalendarRange },
          { label: 'Years covered', value: yearCount, detail: 'With at least one holiday', icon: CalendarDays },
        ]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <HolidayForm />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8':'col-span-12'}>
          <Card title="All holidays" bodyClassName="">
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
                  <Td className="font-medium text-foreground">
                    {row.name}
                  </Td>
                  <Td>
                    <Badge size="sm" color={row.type === 1 ? 'primary' : 'light'}>
                      {row.type === 1 ? 'Range':'Single day'}
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
                          <Phrase>Delete</Phrase>
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
