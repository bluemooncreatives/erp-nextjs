// Holiday Setup - Modules/Leave `HolidayController@index` / `@yearData` /
// `@viewYearData`, `leave::holiday_setup.index`.
//
// All three controller methods render the same Blade and differ only in which
// year is open and whether it is editable, so this is one screen with query
// parameters: `?year=` chooses, `?mode=view` is the read-only form the Blade
// showed when the user only held `view.year.data`.
//
// This is not the Attendance module's `/attendance/holidays`, even though both
// modules register a `holidays` resource against the same table. That screen is
// a flat list of holidays; this one manages years.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { authorize, can } from '@/lib/auth/permissions';
import {
  copyHolidayYear,
  holidayYears,
  holidaysInYear,
  HolidayType,
} from '@/lib/hr/holiday-years';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { ActionButton } from '@/components/erp/submit-button';
import { HolidayYearForm, type HolidayRow } from './holiday-year-form';
import { AddYearForm } from './add-year-form';
import { removeHolidayYear } from './actions';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Holiday Setup' };

const SETUP = ROUTES['year.data'];

/** A `date` column holding "from,to" for a range, or one date. */
function splitDate(stored: string | null, type: number) {
  const value = stored ?? '';
  if (type === HolidayType.MultipleDay) {
    const [from = '', to = ''] = value.split(',');
    return { date: '', startDate: from.trim(), endDate: to.trim() };
  }
  return { date: value.trim(), startDate: '', endDate: '' };
}

export default async function HolidaySetupPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; copy?: string; mode?: string }>;
}) {
  await authorize('holidays.index');
  const sp = await searchParams;

  const years = await holidayYears();
  const requested = sp.year ? Number(sp.year) : null;
  const current =
    requested && years.includes(requested)
      ? requested
      : (requested ?? years[0] ?? new Date().getUTCFullYear());

  const [canAdd, canDelete, canSave, canView] = await Promise.all([
    can('holiday.add'),
    can('holiday.delete'),
    can('holidays.store'),
    can('view.year.data'),
  ]);

  // "Holiday Copy From" loads another year's holidays into this year's form;
  // nothing is written until the form is submitted.
  const copyFrom = sp.copy ? Number(sp.copy) : null;
  const source =
    copyFrom && copyFrom !== current ? await copyHolidayYear(copyFrom) : null;

  const stored = source ?? (await holidaysInYear(current));

  const rows: HolidayRow[] = stored
    // A year created by "Add" is a row with no name - a placeholder for the
    // year itself, not a holiday.
    .filter((row) => (row.name ?? '').trim().length > 0)
    .map((row, index) => ({
      key: index,
      name: row.name ?? '',
      type: row.type,
      ...splitDate(row.date, row.type),
    }));

  const readOnly = sp.mode === 'view' || !canSave;

  return (
    <>
      <PageHeader
        title="Holiday Setup"
        breadcrumb={[{ label: 'Leave' }, { label: 'Holiday Setup' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <Card
          title="Years"
          desc={years.length ? undefined : 'No years have been set up yet.'}
          actions={canAdd ? <AddYearForm /> : null}
        >
          {years.length === 0 ? (
            <EmptyState message="Add a year to start recording its holidays." />
          ) : (
            <ul className="divide-border divide-y">
              {years.map((year) => (
                <li key={year} className="flex items-center justify-between gap-2 py-2">
                  <Link
                    href={`${SETUP}?year=${year}`}
                    className={
                      year === current
                        ? 'text-primary text-sm font-semibold'
                        : 'hover:text-primary text-sm'
                    }
                    aria-current={year === current ? 'true' : undefined}
                  >
                    {year}
                  </Link>

                  <div className="flex items-center gap-1">
                    {canView ? (
                      <Link
                        href={`${SETUP}?year=${year}&mode=view`}
                        className="text-muted-foreground hover:text-primary text-xs font-medium"
                      >
                        <Phrase>View</Phrase>
                      </Link>
                    ) : null}
                    {canDelete ? (
                      <form action={removeHolidayYear}>
                        <input type="hidden" name="year" value={year} />
                        <ActionButton
                          variant="danger"
                          confirm={`Delete ${year} and every holiday recorded in it?`}
                          aria-label={`Delete ${year}`}
                        >
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <HolidayYearForm
          year={current}
          rows={rows}
          otherYears={years.filter((year) => year !== current)}
          copyHref={`${SETUP}?year=${current}&copy={year}`}
          readOnly={readOnly}
        />
      </div>
    </>
  );
}
