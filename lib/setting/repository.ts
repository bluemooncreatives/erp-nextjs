// ---------------------------------------------------------------------------
// Reads behind the Settings and Localization screens.
//
// Ports SettingController@index (business settings, email templates, sms
// gateways, date formats), PaymentGatewayController@index and
// LanguageController@index / @serachBased.
// ---------------------------------------------------------------------------

import 'server-only';
import { asc, eq, isNull, like, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  businessSettings,
  currencies,
  dateFormats,
  emailTemplates,
  languages,
  paymentGateways,
  smsGateways,
  timeZones,
} from '@/lib/db/schema';

/** `BusinessSetting::where('category_type', null)->get()` */
export async function activationSettings() {
  return db
    .select()
    .from(businessSettings)
    .where(isNull(businessSettings.categoryType))
    .orderBy(asc(businessSettings.id));
}

export async function allEmailTemplates() {
  return db.select().from(emailTemplates).orderBy(asc(emailTemplates.id));
}

export async function templatesFor(kind: 'email' | 'sms') {
  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.for, kind))
    .orderBy(asc(emailTemplates.id));
}

export async function allSmsGateways() {
  return db.select().from(smsGateways).orderBy(asc(smsGateways.id));
}

export async function allDateFormats() {
  return db.select().from(dateFormats).orderBy(asc(dateFormats.id));
}

export async function allTimeZones() {
  return db.select().from(timeZones).orderBy(asc(timeZones.id));
}

export async function allCurrencies() {
  return db.select().from(currencies).orderBy(asc(currencies.name));
}

export async function allPaymentGateways() {
  return db.select().from(paymentGateways).orderBy(asc(paymentGateways.id));
}

export async function activeLanguages() {
  return db
    .select()
    .from(languages)
    .where(eq(languages.status, 1))
    .orderBy(asc(languages.name));
}

/** `LanguageRepository::all()` / `::serachBased($keyword)` */
export async function listLanguages(search?: string) {
  const query = db.select().from(languages).orderBy(asc(languages.id));
  if (!search) return query;

  const needle = `%${search}%`;
  return db
    .select()
    .from(languages)
    .where(
      or(
        like(languages.name, needle),
        like(languages.code, needle),
        like(languages.native, needle),
      ),
    )
    .orderBy(asc(languages.id));
}

export async function findLanguage(id: number) {
  const [row] = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
  return row ?? null;
}
