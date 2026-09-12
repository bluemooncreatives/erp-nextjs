'use server';

// Settings actions - ports Modules/Setting's GeneralSettingsController,
// SettingController and PaymentGatewayController.

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { db } from '@/lib/db/client';
import {
  businessSettings,
  currencies,
  emailTemplates,
  generalSettings,
  paymentGateways,
  smsGateways,
} from '@/lib/db/schema';
import { ROUTES } from '@/lib/routes';
import { fileFrom, saveSettingsImage, deleteStoredFile } from '@/lib/uploads';
import { overwriteEnvFile } from '@/lib/env-file';
import { sendMail } from '@/lib/mail';
import { sendSms } from '@/lib/sms';
import { actionFormData } from '@/lib/forms';

export type SettingFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** `GeneralSetting::first()` - the single settings row the PHP always updated. */
async function settingRow() {
  const [row] = await db.select().from(generalSettings).limit(1);
  return row ?? null;
}

/**
 * `GeneralSettingsController@update`.
 *
 * The PHP bound one controller action to two forms: posting an `email` meant the
 * Company Information tab and validated that block, anything else meant the
 * General tab. Both are kept, split by the `company` flag the forms post.
 */
export async function updateGeneralSettings(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('company_information_update');
  const isCompanyForm = formData.get('company') != null;

  const fieldErrors: Record<string, string> = {};
  const values: Record<string, unknown> = { updatedAt: new Date() };

  if (isCompanyForm) {
    if (!str(formData, 'email')) fieldErrors.email = 'The email field is required.';
    if (!str(formData, 'phone')) fieldErrors.phone = 'The phone field is required.';
    if (!str(formData, 'address')) fieldErrors.address = 'The address field is required.';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    Object.assign(values, {
      companyName: str(formData, 'company_name'),
      email: str(formData, 'email'),
      phone: str(formData, 'phone'),
      vatNumber: str(formData, 'vat_number'),
      address: str(formData, 'address'),
      countryName: str(formData, 'country_name'),
      zipCode: str(formData, 'zip_code'),
      companyInfo: str(formData, 'company_info'),
    });
  } else {
    const siteTitle = str(formData, 'site_title');
    if (!siteTitle) fieldErrors.site_title = 'The site title field is required.';
    else if (siteTitle.length > 30)
      fieldErrors.site_title = 'The site title may not be greater than 30 characters.';
    if (!num(formData, 'language_id')) fieldErrors.language_id = 'The language field is required.';
    if (!num(formData, 'date_format_id'))
      fieldErrors.date_format_id = 'The date format field is required.';
    if (!num(formData, 'currency_id')) fieldErrors.currency_id = 'The currency field is required.';
    if (!num(formData, 'time_zone_id'))
      fieldErrors.time_zone_id = 'The time zone field is required.';
    if (!str(formData, 'preloader')) fieldErrors.preloader = 'The preloader field is required.';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    Object.assign(values, {
      siteTitle,
      fileSupported: str(formData, 'file_supported'),
      copyrightText: str(formData, 'copyright_text'),
      languageId: num(formData, 'language_id'),
      dateFormatId: num(formData, 'date_format_id'),
      timeZoneId: num(formData, 'time_zone_id'),
      preloader: str(formData, 'preloader'),
      paymentGateway: num(formData, 'payment_gateway') ?? 1,
    });

    // Picking a currency merged its symbol and code onto the settings row.
    const currencyId = num(formData, 'currency_id');
    if (currencyId) {
      const [currency] = await db
        .select()
        .from(currencies)
        .where(eq(currencies.id, currencyId))
        .limit(1);
      if (currency) {
        values.currency = String(currencyId);
        values.currencySymbol = currency.symbol;
        values.currencyCode = currency.code;
      }
    }

    const logo = await saveSettingsImage(fileFrom(formData, 'site_logo'));
    if (logo) values.logo = logo;

    const favicon = await saveSettingsImage(fileFrom(formData, 'favicon_logo'));
    if (favicon) values.favicon = favicon;
  }

  const setting = await settingRow();
  if (!setting) return { error: 'Something Went Wrong' };

  try {
    await db.update(generalSettings).set(values).where(eq(generalSettings.id, setting.id));
    await successLog('GeneralSetting Credentials has been updated Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath('/', 'layout');
  return { success: 'GeneralSetting Credentials has been updated Successfully' };
}

/** `GeneralSettingsController@invoice_update` */
export async function updateInvoiceSettings(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('invoice_settings_update');
  const setting = await settingRow();
  if (!setting) return { error: 'Something Went Wrong' };

  try {
    await db
      .update(generalSettings)
      .set({
        remarksTitle: str(formData, 'remarks_title'),
        remarksBody: str(formData, 'remarks_body'),
        termsConditions: str(formData, 'terms_conditions'),
        updatedAt: new Date(),
      })
      .where(eq(generalSettings.id, setting.id));
    await successLog('Invoice settings updated', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['setting.index']);
  return { success: 'GeneralSetting Credentials has been updated Successfully' };
}

/**
 * `GeneralSettingsController@smtp_gateway_credentials_update` - saves the
 * protocol on the settings row and the credentials into `.env`.
 */
export async function updateSmtpCredentials(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('smtp_gateway_credentials_update');

  const protocol = str(formData, 'mail_protocol');
  if (!protocol) return { fieldErrors: { mail_protocol: 'The mail protocol field is required.' } };

  const setting = await settingRow();
  if (!setting) return { error: 'Something Went Wrong' };

  try {
    await db
      .update(generalSettings)
      .set({
        mailProtocol: protocol,
        mailSignature: str(formData, 'mail_signature'),
        updatedAt: new Date(),
      })
      .where(eq(generalSettings.id, setting.id));

    const env: Record<string, string> = { MAIL_MAILER: protocol };
    for (const type of formData.getAll('types').map(String)) {
      if (type === 'MAIL_MAILER') continue;
      env[type] = String(formData.get(type) ?? '');
    }
    await overwriteEnvFile(env);

    await successLog('SMTP Gateways Credentials has been updated Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['setting.index']);
  return { success: 'SMTP Gateways Credentials has been updated Successfully' };
}

/**
 * `GeneralSettingsController@sms_gateway_credentials_update` - makes one gateway
 * the active one and writes its keys into `.env`.
 */
export async function updateSmsCredentials(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('sms_gateway_credentials_update');

  const gatewayId = num(formData, 'sms_gateway_id');
  if (!gatewayId) {
    return { fieldErrors: { sms_gateway_id: 'The sms gateway field is required.' } };
  }

  try {
    await db.update(smsGateways).set({ status: 0, updatedAt: new Date() });
    await db
      .update(smsGateways)
      .set({ status: 1, updatedAt: new Date() })
      .where(eq(smsGateways.id, gatewayId));

    const env: Record<string, string> = {};
    for (const type of formData.getAll('types').map(String)) {
      env[type] = String(formData.get(type) ?? '');
    }
    await overwriteEnvFile(env);

    await successLog('SMS Gateways Credentials has been updated Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['setting.index']);
  return { success: 'SMS Gateways Credentials has been updated Successfully' };
}

/** `GeneralSettingsController@test_mail_send` */
export async function sendTestMailAction(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('test_mail.send');
  const to = str(formData, 'email');
  const content = str(formData, 'content');
  if (!to) return { fieldErrors: { email: 'The email field is required.' } };
  if (!content) return { fieldErrors: { content: 'The content field is required.' } };

  try {
    const sent = await sendMail({ to, subject: 'Test Mail', html: `<p>${content}</p>` });
    return sent
      ? { success: 'Mail has been sent Successfully' }
      : { error: 'Please Configure SMTP settings first' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

/** `GeneralSettingsController@sms_send_demo` */
export async function sendTestSmsAction(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('sms_send_demo');
  const to = str(formData, 'number');
  const message = str(formData, 'message');
  if (!to) return { fieldErrors: { number: 'The number field is required.' } };

  try {
    const sent = await sendSms(to, message ?? '');
    return sent
      ? { success: 'SMS has been sent Successfully' }
      : { error: 'Something Went Wrong' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

/**
 * `GeneralSettingsController@template_update` - the template forms posted the
 * template's `type` as `name` and its body under a field of that same name.
 */
export async function updateEmailTemplate(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('template_update');
  const type = str(formData, 'name');
  if (!type) return { error: 'Something Went Wrong' };

  const isSms = formData.get('sms_template') != null;

  try {
    const values: Record<string, unknown> = {
      value: String(formData.get(type) ?? ''),
      updatedAt: new Date(),
    };
    if (!isSms) values.subject = str(formData, 'subject');

    await db.update(emailTemplates).set(values).where(eq(emailTemplates.type, type));
    await successLog(`${type} template updated`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['setting.index']);
  return {
    success: isSms
      ? 'SMS Template has been updated Successfully'
      : 'Email Template has been updated Successfully',
  };
}

/** `GeneralSettingsController@footer_update` */
export async function updateMailFooter(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('general_setting_footer_update');
  const setting = await settingRow();
  if (!setting) return { error: 'Something Went Wrong' };

  try {
    await db
      .update(generalSettings)
      .set({ mailFooter: str(formData, 'mail_footer'), updatedAt: new Date() })
      .where(eq(generalSettings.id, setting.id));
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['setting.index']);
  return { success: 'Email Footer has been updated Successfully' };
}

/** `SettingController@update_activation_status` */
export async function toggleBusinessSetting(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const status = Number(formData.get('status'));
  const user = await authorize('update_activation_status');

  const [row] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.id, id))
    .limit(1);
  if (!row) {
    await errorLog('Error has been detected for BusinessSetting', user.id);
    return;
  }

  await db
    .update(businessSettings)
    .set({ status, updatedAt: new Date() })
    .where(eq(businessSettings.id, id));

  await successLog(`${row.type} has been upddated.`, user.id);
  revalidatePath(ROUTES['setting.index']);
}

/**
 * `PaymentGatewayController@updateActive` - every gateway ticked in the list is
 * activated and every other one deactivated.
 */
export async function updateActivePaymentMethods(formData: FormData): Promise<void> {
  await authorize('update-active-method');

  const chosen = new Set(formData.getAll('gateways').map((v) => Number(v)));
  const rows = await db.select({ id: paymentGateways.id }).from(paymentGateways);

  for (const row of rows) {
    await db
      .update(paymentGateways)
      .set({ activeStatus: chosen.has(row.id) ? 1 : 0, updatedAt: new Date() })
      .where(eq(paymentGateways.id, row.id));
  }

  revalidatePath(ROUTES['payment-method-settings']);
}

/** `PaymentGatewayController@update` */
export async function updatePaymentGateway(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('update-payment-method-settings');
  const id = Number(formData.get('id'));

  try {
    await db
      .update(paymentGateways)
      .set({
        gatewayName: str(formData, 'gateway_name'),
        gatewayUsername: str(formData, 'gateway_username'),
        gatewayApiKey: str(formData, 'gateway_api_key'),
        gatewaySecretKey: str(formData, 'gateway_secret_key'),
        redirectUrl: str(formData, 'redirect_url'),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(paymentGateways.id, id));
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Operation Failed' };
  }

  revalidatePath(ROUTES['payment-method-settings']);
  return { success: 'Operation successful' };
}

/** `GeneralSettingsController@post_update_bg` */
export async function updateGuestBackground(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('guest-background');
  const setting = await settingRow();
  if (!setting) return { error: 'Something Went Wrong' };

  try {
    const values: Record<string, unknown> = { updatedAt: new Date() };

    const loginBg = await saveSettingsImage(fileFrom(formData, 'login_bg'));
    if (loginBg) values.loginBg = loginBg;

    const errorBg = await saveSettingsImage(fileFrom(formData, 'error_page_bg'));
    if (errorBg) values.errorPageBg = errorBg;

    await db.update(generalSettings).set(values).where(eq(generalSettings.id, setting.id));
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath('/', 'layout');
  return { success: 'Background image updated Successfully' };
}

/** `GeneralSettingsController@post_change_view` */
export async function changeDefaultView(
  _prev: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  formData = actionFormData(_prev, formData);
  await authorize('themes.change_view');
  const view = String(formData.get('view') ?? '');
  if (view !== 'normal' && view !== 'compact') {
    return { fieldErrors: { view: 'The selected view is invalid.' } };
  }

  const setting = await settingRow();
  if (!setting) return { error: 'Something Went Wrong' };

  await db
    .update(generalSettings)
    .set({ defaultView: view, updatedAt: new Date() })
    .where(eq(generalSettings.id, setting.id));

  revalidatePath('/', 'layout');
  return { success: `${view === 'normal' ? 'Normal' : 'Compact'} view changed as default view` };
}

/** `GeneralSettingsController@remove` */
export async function removeSettingImage(formData: FormData): Promise<void> {
  const type = String(formData.get('type') ?? '');
  const user = await authorize('setting.remove');

  const setting = await settingRow();
  if (!setting) return;

  if (type === 'logo') {
    if (setting.logo !== 'public/uploads/settings/logo.png') {
      await deleteStoredFile(setting.logo);
    }
    await db
      .update(generalSettings)
      .set({ logo: 'public/uploads/settings/logo.png', updatedAt: new Date() })
      .where(eq(generalSettings.id, setting.id));
  } else if (type === 'favicon') {
    if (setting.favicon !== 'public/uploads/settings/favicon.png') {
      await deleteStoredFile(setting.favicon);
    }
    await db
      .update(generalSettings)
      .set({ favicon: 'public/uploads/settings/favicon.png', updatedAt: new Date() })
      .where(eq(generalSettings.id, setting.id));
  } else {
    return;
  }

  await successLog(`${type} image remove Successfully`, user.id);
  revalidatePath('/', 'layout');
}
