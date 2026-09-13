'use client';

// The right-hand panel of `leave::holiday_setup.index`: the chosen year's
// holidays, as editable rows.
//
// The Blade fetched a blank row from the server (`add.row`) and the copy-from
// list through `last.year.data`, both over AJAX. Rows are client state here and
// the copy is a plain link, so the round trips go away and the form still posts
// the same parallel arrays the PHP read.

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { Button } from '@/components/ui/button';
import { saveHolidays, type HolidayFormState } from './actions';

const INITIAL: HolidayFormState = {};

const SINGLE_DAY = 0;
const MULTIPLE_DAY = 1;

export type HolidayRow = {
  key: number;
  name: string;
  type: number;
  date: string;
  startDate: string;
  endDate: string;
};

export function HolidayYearForm({
  year,
  rows,
  otherYears,
  copyHref,
  readOnly,
}: {
  year: number;
  rows: HolidayRow[];
  otherYears: number[];
  /** `{year}` is replaced with the year to copy from. */
  copyHref: string;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(saveHolidays, INITIAL);
  const [lines, setLines] = useState<HolidayRow[]>(
    rows.length ? rows : [blankRow()],
  );

  function blankRow(): HolidayRow {
    return {
      key: Date.now() + Math.random(),
      name: '',
      type: SINGLE_DAY,
      date: '',
      startDate: '',
      endDate: '',
    };
  }

  const patch = (key: number, changes: Partial<HolidayRow>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );

  return (
    <Card
      title={`Holidays in ${year}`}
      desc={
        readOnly
          ? 'You do not have permission to change these.'
          : 'Saving replaces the whole year, and marks everyone present as on holiday for these dates.'
      }
    >
      {otherYears.length > 0 && !readOnly ? (
        <div className="mb-6 max-w-sm">
          <FormSelect
            label="Holiday Copy From"
            name="_copy_from"
            defaultValue=""
            placeholder="Select one"
            options={otherYears.map((other) => ({ value: other, label: String(other) }))}
            hint="Opens that year's holidays here, ready to save against this one."
            onChange={(event) => {
              if (event.target.value) {
                window.location.href = copyHref.replace('{year}', event.target.value);
              }
            }}
          />
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="year" value={year} />

        {state.error ? <FormAlert variant="error" message={state.error} /> : null}
        {state.success ? <FormAlert variant="success" message={state.success} /> : null}

        {state.fieldErrors?.year ? (
          <p className="text-destructive text-xs">{state.fieldErrors.year}</p>
        ) : null}
        {state.fieldErrors?.holiday_name ? (
          <p className="text-destructive text-xs">{state.fieldErrors.holiday_name}</p>
        ) : null}
        {state.fieldErrors?.date ? (
          <p className="text-destructive text-xs">{state.fieldErrors.date}</p>
        ) : null}

        {lines.map((line) => (
          <div key={line.key} className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto]">
            <FormInput
              label="Holiday Name"
              name="holiday_name"
              value={line.name}
              disabled={readOnly}
              onChange={(event) => patch(line.key, { name: event.target.value })}
            />

            <FormSelect
              label="Select Type"
              name="type"
              value={String(line.type)}
              disabled={readOnly}
              options={[
                { value: String(SINGLE_DAY), label: 'Single Day' },
                { value: String(MULTIPLE_DAY), label: 'Multiple Day' },
              ]}
              onChange={(event) => patch(line.key, { type: Number(event.target.value) })}
            />

            {/* Both shapes always post, so the parallel arrays stay aligned with
                one entry per row - which is how the action reads them. */}
            {line.type === MULTIPLE_DAY ? (
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  type="date"
                  label="Start Date"
                  name="start_date"
                  value={line.startDate}
                  disabled={readOnly}
                  onChange={(event) => patch(line.key, { startDate: event.target.value })}
                />
                <FormInput
                  type="date"
                  label="End Date"
                  name="end_date"
                  value={line.endDate}
                  disabled={readOnly}
                  onChange={(event) => patch(line.key, { endDate: event.target.value })}
                />
                <input type="hidden" name="date" value="" />
              </div>
            ) : (
              <>
                <FormInput
                  type="date"
                  label="Date"
                  name="date"
                  value={line.date}
                  disabled={readOnly}
                  onChange={(event) => patch(line.key, { date: event.target.value })}
                />
                <input type="hidden" name="start_date" value="" />
                <input type="hidden" name="end_date" value="" />
              </>
            )}

            <div className="flex items-end">
              {!readOnly && lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this holiday"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setLines((current) => current.filter((row) => row.key !== line.key))
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          </div>
        ))}

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="soft"
              onClick={() => setLines((current) => [...current, blankRow()])}
            >
              <Plus />
              Add
            </Button>
            <SubmitButton>Submit</SubmitButton>
          </div>
        ) : null}
      </form>

      {readOnly ? (
        <p className="text-muted-foreground mt-4 text-sm">
          <Link href="/leave" className="text-primary hover:text-primary">
            Back to Leave
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
