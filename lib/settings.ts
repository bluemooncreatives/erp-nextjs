// ---------------------------------------------------------------------------
// Global settings - the replacement for `app('general_setting')`, which the
// Blade templates reached for on nearly every page (currency symbol, logo,
// company name, date format, feature toggles).
//
// Laravel resolved it once per request from the container; `cache()` gives the
// same request-scoped memoisation here.
// ---------------------------------------------------------------------------

import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  currencies,
  dateFormats,
  generalSettings,
  introPrefix,
  timeZones,
  type GeneralSettingsRow,
} from '@/lib/db/schema';
import { phpDate } from '@/lib/php-date';

export type GeneralSetting = GeneralSettingsRow & {
  /** `app('general_setting')->dateFormat->format` */
  dateFormatString: string;
  timeZoneName: string | null;
};

const FALLBACK_DATE_FORMAT = 'jS M, Y';

export const generalSetting = cache(async (): Promise<GeneralSetting> => {
  const [row] = await db.select().from(generalSettings).limit(1);

  if (!row) {
    // The PHP app assumed the row exists (it ships in the installer seed).
    // Fail soft with defaults so an unconfigured install still renders.
    return {
      ...(EMPTY_SETTING as GeneralSettingsRow),
      dateFormatString: FALLBACK_DATE_FORMAT,
      timeZoneName: null,
    };
  }

  const [fmt] = row.dateFormatId
    ? await db
        .select({ format: dateFormats.format })
        .from(dateFormats)
        .where(eq(dateFormats.id, row.dateFormatId))
        .limit(1)
    : [];

  const [tz] = row.timeZoneId
    ? await db
        .select({ name: timeZones.timeZone })
        .from(timeZones)
        .where(eq(timeZones.id, row.timeZoneId))
        .limit(1)
    : [];

  return {
    ...row,
    dateFormatString: fmt?.format ?? FALLBACK_DATE_FORMAT,
    timeZoneName: tz?.name ?? null,
  };
});

/** `dateConvert($input_date)` from Helper.php. */
export async function dateConvert(input: Date | string | null | undefined): Promise<string> {
  if (input == null || input === '') return '';
  const setting = await generalSetting();
  try {
    return phpDate(setting.dateFormatString, input);
  } catch {
    return String(input);
  }
}

/** `single_price($price)` - currency symbol + 2-decimal thousands separators. */
export async function singlePrice(price: number | string | null | undefined): Promise<string> {
  const setting = await generalSetting();
  return formatPrice(price, setting.currencySymbol);
}

/** `single_price_pdf($price)` - falls back to a trailing 'BDT' like the PHP helper. */
export async function singlePricePdf(price: number | string | null | undefined): Promise<string> {
  const setting = await generalSetting();
  if (setting.currencySymbol && setting.currencyCode !== 'BDT') {
    return `${setting.currencySymbol} ${numberFormat(price)}`;
  }
  return `${numberFormat(price)} BDT`;
}

/** Pure formatter - usable from client components once the symbol is passed down. */
export function formatPrice(
  price: number | string | null | undefined,
  symbol: string | null | undefined,
): string {
  const n = numberFormat(price);
  // A non-breaking space, so a table cell never wraps between the currency
  // symbol and the figure - "$" alone on one line and "2,600.00" on the next
  // is how every money column in a narrow table used to read.
  return symbol ? `${symbol} ${n}` : `${n} bdt`;
}

/** PHP's `number_format($v, 2)`. */
export function numberFormat(value: number | string | null | undefined, decimals = 2): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? (n as number) : 0;
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** `leadingZeroTwo($value)` - sprintf('%02d'). */
export function leadingZeroTwo(value: number | string): string {
  return String(Number(value) || 0).padStart(2, '0');
}

/**
 * `IntroPrefix::find($id)->prefix` - the document-number prefixes. The ids are
 * fixed by the installer seed and referenced directly in the PHP model `boot()`
 * hooks, so they are named here rather than looked up by label.
 */
export const IntroPrefixId = {
  /** PO - purchase order */
  PurchaseOrder: 1,
  /** PI - purchase invoice */
  PurchaseInvoice: 2,
  /** INV - sales invoice */
  SalesInvoice: 3,
  /** QTA - customer quotation */
  Quotation: 4,
  /** RET - retailer */
  Retailer: 5,
  /** CUS - customer */
  Customer: 6,
  /** SUP - supplier */
  Supplier: 7,
  /** EMP - staff */
  Staff: 8,
  /** PSO - packing */
  Packing: 9,
} as const;

export const introPrefixFor = cache(async (id: number): Promise<string | null> => {
  const [row] = await db
    .select({ prefix: introPrefix.prefix })
    .from(introPrefix)
    .where(eq(introPrefix.id, id))
    .limit(1);
  return row?.prefix ?? null;
});

export const defaultCurrency = cache(async () => {
  const setting = await generalSetting();
  if (!setting.currencyCode) return null;
  const [row] = await db
    .select()
    .from(currencies)
    .where(eq(currencies.code, setting.currencyCode))
    .limit(1);
  return row ?? null;
});

/** `checkCurrency($code)` from Helper.php. */
export async function checkCurrency(code: string): Promise<boolean> {
  const [row] = await db
    .select({ id: currencies.id })
    .from(currencies)
    .where(eq(currencies.code, code))
    .limit(1);
  return Boolean(row);
}

const EMPTY_SETTING: Partial<GeneralSettingsRow> = {
  id: 0,
  siteTitle: 'Infix Biz',
  companyName: 'Infix Biz',
  currency: 'USD',
  currencySymbol: '$',
  currencyCode: 'USD',
  logo: 'public/uploads/settings/logo.png',
  favicon: 'public/uploads/settings/favicon.png',
  languageName: 'en',
  dateFormatId: 1,
  contactLogin: 0,
  defaultView: 'normal',
};
