// Holiday Setup - port of Modules/Leave `HolidayController` and
// `HolidayRepository` (`leave::holiday_setup.index`).
//
// This is a different screen from the Attendance module's flat holiday list at
// `/attendance/holidays`, even though both modules register a `holidays`
// resource against the same table. Here a year is the unit: you add a year,
// fill in its holidays (optionally copying another year's), and deleting a year
// removes all of them.
//
// Saving a year does more than write `holidays`. For every holiday, the PHP
// clears any attendance already recorded on those dates and then marks every
// user of every non-`system_user` role present as `H`. Without that the
// attendance report counts a holiday as an absence, so it is carried here.

import 'server-only';
import { between, desc, eq, ne } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import { attendances, holidays, roles, users } from '@/lib/db/schema';

/** `type` 0 is one date; 1 is a range stored as "from,to" in a single column. */
export const HolidayType = { SingleDay: 0, MultipleDay: 1 } as const;

export type HolidayInput = {
  name: string;
  type: number;
  /** Used when `type` is SingleDay. */
  date?: string | null;
  /** Used when `type` is MultipleDay. */
  startDate?: string | null;
  endDate?: string | null;
};

/** `holidayYears()` - `groupBy('year')->orderBy('year','desc')`. */
export async function holidayYears(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: holidays.year })
    .from(holidays)
    .orderBy(desc(holidays.year));
  return rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year));
}

/** `year($year)` - defaults to the current year, as the PHP did. */
export async function holidaysInYear(year?: number | null) {
  const wanted = year ?? new Date().getUTCFullYear();
  return db
    .select()
    .from(holidays)
    .where(eq(holidays.year, wanted))
    .orderBy(holidays.id);
}

/** `yearCreate(['year' => ...])` - an empty year, ready to be filled in. */
export async function createHolidayYear(year: number): Promise<void> {
  await db.insert(holidays).values({
    year,
    // The PHP passed only `year`; `name`, `type` and `date` take their column
    // defaults, which is what makes the row a placeholder rather than a holiday.
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** `yearDelete($year)` - the year and every holiday in it. */
export async function deleteHolidayYear(year: number): Promise<void> {
  await db.delete(holidays).where(eq(holidays.year, year));
}

/** Every date a holiday covers - one for a single day, the span for a range. */
function datesCovered(holiday: HolidayInput): string[] {
  if (holiday.type !== HolidayType.MultipleDay) {
    return holiday.date ? [holiday.date] : [];
  }
  if (!holiday.startDate || !holiday.endDate) return [];

  const out: string[] = [];
  const end = new Date(`${holiday.endDate}T00:00:00Z`);
  for (
    let cursor = new Date(`${holiday.startDate}T00:00:00Z`);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    out.push(cursor.toISOString().slice(0, 10));
  }
  return out;
}

/** What the `date` column holds: one date, or "from,to". */
function storedDate(holiday: HolidayInput): string {
  return holiday.type === HolidayType.MultipleDay
    ? `${holiday.startDate ?? ''},${holiday.endDate ?? ''}`
    : (holiday.date ?? '');
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * `HolidayRepository::create($data)`.
 *
 * The year's holidays are replaced wholesale - the PHP deletes the year first,
 * so a row removed from the form is removed from the table. Then, per holiday:
 * `attendanceByDate()` clears whatever attendance those dates already hold, and
 * every user of every non-system role is marked `H` with the holiday's name.
 */
export async function saveHolidayYear(
  year: number,
  entries: HolidayInput[],
): Promise<void> {
  // Only the roles the PHP marked: `where('type', '!=', 'system_user')`.
  const markable = await db
    .select({ userId: users.id, roleId: users.roleId })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(ne(roles.type, 'system_user'));

  await runInTransaction(async (tx) => {
    await tx.delete(holidays).where(eq(holidays.year, year));

    for (const entry of entries) {
      const named = entry.name?.trim();
      const dates = datesCovered(entry);

      // `if ($data['holiday_name'][$key])` - a blank row writes no holiday, but
      // the PHP still cleared and re-marked attendance for its dates. A blank
      // row has no dates either, so in practice both are skipped together.
      if (named) {
        await tx.insert(holidays).values({
          year,
          name: named,
          type: entry.type,
          date: storedDate(entry),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (dates.length === 0) continue;

      // `attendanceByDate($date, $type)` - a single date, or the whole span.
      if (entry.type === HolidayType.MultipleDay) {
        await tx
          .delete(attendances)
          .where(between(attendances.date, dates[0], dates[dates.length - 1]));
      } else {
        await tx.delete(attendances).where(eq(attendances.date, dates[0]));
      }

      if (!named || markable.length === 0) continue;

      const marks = [];
      for (const date of dates) {
        const day = new Date(`${date}T00:00:00Z`);
        for (const person of markable) {
          marks.push({
            userId: person.userId,
            roleId: person.roleId,
            date,
            day: DAY_NAMES[day.getUTCDay()],
            month: MONTH_NAMES[day.getUTCMonth()],
            year: day.getUTCFullYear(),
            attendance: 'H',
            note: `Holiday for ${named}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // One statement per holiday rather than per user: the PHP saved a model
      // at a time, which on a year of ranges is thousands of round trips.
      for (let index = 0; index < marks.length; index += 500) {
        await tx.insert(attendances).values(marks.slice(index, index + 500));
      }
    }
  });
}

/** `copyYear($year)` - the source year's holidays, to seed another year's form. */
export async function copyHolidayYear(year: number) {
  return db.select().from(holidays).where(eq(holidays.year, year)).orderBy(holidays.id);
}
