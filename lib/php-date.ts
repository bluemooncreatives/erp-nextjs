// ---------------------------------------------------------------------------
// PHP `date()` format implementation.
//
// The `date_formats` table stores PHP format strings ('jS M, Y', 'd/m/Y',
// 'g:ia \o\n l jS F Y', ...) and the whole UI ran every date through
// `dateConvert()` -> `date_format(date_create($d), $system_date_format)`.
// Ports of those screens need the identical output, so the format characters
// are implemented here rather than approximated with a JS date library.
// ---------------------------------------------------------------------------

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function ordinalSuffix(d: number): string {
  if (d % 100 >= 11 && d % 100 <= 13) return 'th';
  switch (d % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Format a date with a PHP `date()` format string.
 * Backslash escapes a character, exactly as PHP does ('\o\n' -> 'on').
 */
export function phpDate(format: string, input: Date | string | number): string {
  const d = toUtcDate(input);
  if (!d) return '';

  let out = '';
  for (let i = 0; i < format.length; i++) {
    const ch = format[i];

    if (ch === '\\') {
      i++;
      if (i < format.length) out += format[i];
      continue;
    }

    switch (ch) {
      // --- Day ---
      case 'd': out += pad(d.getUTCDate()); break;
      case 'D': out += DAYS[d.getUTCDay()].slice(0, 3); break;
      case 'j': out += String(d.getUTCDate()); break;
      case 'l': out += DAYS[d.getUTCDay()]; break;
      case 'N': out += String(d.getUTCDay() === 0 ? 7 : d.getUTCDay()); break;
      case 'S': out += ordinalSuffix(d.getUTCDate()); break;
      case 'w': out += String(d.getUTCDay()); break;
      case 'z': out += String(dayOfYear(d)); break;

      // --- Week ---
      case 'W': out += pad(isoWeek(d)); break;

      // --- Month ---
      case 'F': out += MONTHS[d.getUTCMonth()]; break;
      case 'm': out += pad(d.getUTCMonth() + 1); break;
      case 'M': out += MONTHS[d.getUTCMonth()].slice(0, 3); break;
      case 'n': out += String(d.getUTCMonth() + 1); break;
      case 't': out += String(daysInMonth(d.getUTCFullYear(), d.getUTCMonth())); break;

      // --- Year ---
      case 'L': out += isLeap(d.getUTCFullYear()) ? '1' : '0'; break;
      case 'o': out += String(d.getUTCFullYear()); break;
      case 'Y': out += String(d.getUTCFullYear()); break;
      case 'y': out += pad(d.getUTCFullYear() % 100); break;

      // --- Time ---
      case 'a': out += d.getUTCHours() < 12 ? 'am' : 'pm'; break;
      case 'A': out += d.getUTCHours() < 12 ? 'AM' : 'PM'; break;
      case 'g': out += String(d.getUTCHours() % 12 || 12); break;
      case 'G': out += String(d.getUTCHours()); break;
      case 'h': out += pad(d.getUTCHours() % 12 || 12); break;
      case 'H': out += pad(d.getUTCHours()); break;
      case 'i': out += pad(d.getUTCMinutes()); break;
      case 's': out += pad(d.getUTCSeconds()); break;
      case 'u': out += pad(d.getUTCMilliseconds() * 1000, 6); break;
      case 'v': out += pad(d.getUTCMilliseconds(), 3); break;

      // --- Timezone / full date-time ---
      case 'e': case 'T': out += 'UTC'; break;
      case 'I': out += '0'; break;
      case 'O': out += '+0000'; break;
      case 'P': out += '+00:00'; break;
      case 'Z': out += '0'; break;
      case 'c': out += d.toISOString().replace(/\.\d{3}Z$/, '+00:00'); break;
      case 'r':
        out +=
          `${DAYS[d.getUTCDay()].slice(0, 3)}, ${pad(d.getUTCDate())} ` +
          `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()} ` +
          `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`;
        break;
      case 'U': out += String(Math.floor(d.getTime() / 1000)); break;

      default: out += ch;
    }
  }
  return out;
}

/**
 * Parse the value shapes the database hands back: 'YYYY-MM-DD' (DATE columns
 * come through as strings), 'YYYY-MM-DD HH:MM:SS', a Date, or an epoch.
 * Interpreted as UTC so formatting never shifts a date across a day boundary.
 */
export function toUtcDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') return new Date(input);

  const s = input.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    return new Date(
      Date.UTC(
        Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0),
      ),
    );
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 'YYYY-MM-DD' - the storage format for every DATE column in this schema. */
export function toDateString(input: Date | string | null | undefined): string | null {
  const d = toUtcDate(input);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'YYYY-MM-DD HH:MM:SS' - the storage format for TIMESTAMP columns. */
export function toDateTimeString(input: Date | string | null | undefined): string | null {
  const d = toUtcDate(input);
  if (!d) return null;
  return (
    `${toDateString(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

export function today(): string {
  return toDateString(new Date())!;
}

export function startOfWeek(ref = new Date()): string {
  const d = toUtcDate(ref)!;
  // Carbon's startOfWeek is Monday.
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return toDateString(d)!;
}

export function endOfWeek(ref = new Date()): string {
  const d = toUtcDate(startOfWeek(ref))!;
  d.setUTCDate(d.getUTCDate() + 6);
  return toDateString(d)!;
}

export function startOfMonth(ref = new Date()): string {
  const d = toUtcDate(ref)!;
  return toDateString(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)))!;
}

export function endOfMonth(ref = new Date()): string {
  const d = toUtcDate(ref)!;
  return toDateString(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))!;
}

export function startOfYear(ref = new Date()): string {
  const d = toUtcDate(ref)!;
  return toDateString(new Date(Date.UTC(d.getUTCFullYear(), 0, 1)))!;
}

export function endOfYear(ref = new Date()): string {
  const d = toUtcDate(ref)!;
  return toDateString(new Date(Date.UTC(d.getUTCFullYear(), 11, 31)))!;
}

export function addDays(ref: Date | string, days: number): string {
  const d = toUtcDate(ref)!;
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d)!;
}

export function diffInDays(from: Date | string, to: Date | string): number {
  const a = toUtcDate(from);
  const b = toUtcDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
