'use server';

// Holiday Setup - Modules/Leave `HolidayController`.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { actionFormData } from '@/lib/forms';
import { ROUTES } from '@/lib/routes';
import {
  HolidayType,
  createHolidayYear,
  deleteHolidayYear,
  saveHolidayYear,
  type HolidayInput,
} from '@/lib/hr/holiday-years';

export type HolidayFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Both modules register a `holidays` resource, so `holidays.index` is
 * ambiguous in Laravel itself. In this port it names the Attendance module's
 * flat list; this screen is the Leave module's Holiday Setup, which the
 * year-specific route names point at.
 */
const SETUP = ROUTES['year.data'];

const text = (formData: FormData, field: string) =>
  String(formData.get(field) ?? '').trim();

/** `HolidayController@holidayAdd` */
export async function addHolidayYear(
  _prev: HolidayFormState,
  formData?: FormData,
): Promise<HolidayFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('holiday.add');

  const year = Number(text(formData, 'year'));
  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    return { fieldErrors: { year: 'Enter a four-digit year.' } };
  }

  try {
    await createHolidayYear(year);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  await successLog(`Holiday year ${year} has been created.`, user.id);
  revalidatePath(SETUP);
  redirect(`${SETUP}?year=${year}`);
}

/** `HolidayController@holidayDelete` */
export async function removeHolidayYear(formData: FormData): Promise<void> {
  const user = await authorize('holiday.delete');
  const year = Number(formData.get('year'));
  if (!Number.isInteger(year)) return;

  try {
    await deleteHolidayYear(year);
    await successLog(`Holiday year ${year} has been deleted.`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(SETUP);
  redirect(SETUP);
}

/**
 * `HolidayController@store`, which replaces the whole year.
 *
 * The PHP validated `holiday_name` and `type` as required, `date` when the type
 * is a single day and `start_date` / `end_date` when it is a range. Rows arrive
 * as parallel arrays, one entry per row, exactly as the Blade posted them.
 */
export async function saveHolidays(
  _prev: HolidayFormState,
  formData?: FormData,
): Promise<HolidayFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('holidays.store');

  const year = Number(text(formData, 'year'));
  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    return { fieldErrors: { year: 'Enter a four-digit year.' } };
  }

  const names = formData.getAll('holiday_name').map(String);
  const types = formData.getAll('type').map((value) => Number(value));
  const dates = formData.getAll('date').map(String);
  const startDates = formData.getAll('start_date').map(String);
  const endDates = formData.getAll('end_date').map(String);

  const entries: HolidayInput[] = [];
  for (const [index, rawName] of names.entries()) {
    const name = rawName.trim();
    const type = types[index] ?? HolidayType.SingleDay;

    // A wholly blank row is how the form offers "one more line"; the PHP
    // skipped it rather than failing the save.
    const single = (dates[index] ?? '').trim();
    const from = (startDates[index] ?? '').trim();
    const to = (endDates[index] ?? '').trim();
    if (!name && !single && !from && !to) continue;

    if (!name) return { fieldErrors: { holiday_name: 'Every holiday needs a name.' } };

    if (type === HolidayType.MultipleDay) {
      if (!from || !to) {
        return { fieldErrors: { date: 'A multiple-day holiday needs both dates.' } };
      }
      if (to < from) {
        return { fieldErrors: { date: 'The end date cannot precede the start date.' } };
      }
    } else if (!single) {
      return { fieldErrors: { date: 'A single-day holiday needs its date.' } };
    }

    entries.push({ name, type, date: single, startDate: from, endDate: to });
  }

  try {
    await saveHolidayYear(year, entries);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  await successLog(`Holiday settings for ${year} have been saved.`, user.id);
  revalidatePath(SETUP);
  redirect(`${SETUP}?year=${year}`);
}
