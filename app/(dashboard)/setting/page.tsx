import { SettingsSection } from '@/components/common/settings-section';
// Settings - port of Modules/Setting `setting::index` and its page components.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { generalSetting } from '@/lib/settings';
import { uploadedAssetUrl } from '@/lib/paths.server';
import { envValue } from '@/lib/env-file';
import {
  activationSettings,
  allCurrencies,
  allDateFormats,
  allSmsGateways,
  allTimeZones,
  activeLanguages,
  templatesFor,
} from '@/lib/setting/repository';
import { PageHeader, Card } from '@/components/erp/page';
import { Tabs, type TabItem } from '@/components/erp/tabs';
import { SettingsRow } from '@/components/common/settings-section';
import { ToggleSwitch } from '@/components/erp/toggle';
import { toggleBusinessSetting } from './actions';
import {
  GeneralSettingsForm,
  CompanyInformationForm,
  InvoiceSettingsForm,
  SmtpSettingsForm,
  SmsSettingsForm,
  TestMailForm,
  TestSmsForm,
  TemplateForm,
  MailFooterForm,
} from './forms';

export const metadata: Metadata = { title: 'Settings' };

/** `strtoupper(str_replace("_", " ", $type))` */
function typeLabel(type: string | null): string {
  return (type ?? '').replace(/_/g, ' ').toUpperCase();
}

/** Sentence case for a settings row: "email_verification" -> "Email verification". */
function settingTitle(type: string | null): string {
  const words = (type ?? '').replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What each switch actually turns on, so a row is more than a key name. */
const SETTING_DESCRIPTION: Record<string, string> = {
  emailverification: 'Require a new account to confirm its email address before signing in.',
  email_verification: 'Require a new account to confirm its email address before signing in.',
  mailnotification: 'Send the document emails - invoices, orders and payment receipts.',
  mail_notification: 'Send the document emails - invoices, orders and payment receipts.',
  systemnotification: 'Raise in-app notifications for staff when documents change.',
  system_notification: 'Raise in-app notifications for staff when documents change.',
  systemregistration: 'Let visitors create their own account from the sign-up page.',
  system_registration: 'Let visitors create their own account from the sign-up page.',
  smsnotification: 'Send the document text messages through the configured SMS gateway.',
  sms_notification: 'Send the document text messages through the configured SMS gateway.',
};

/**
 * `setting::index`. `HomeController@company` renders the same view with
 * `$company` set, which the Blade uses only to open the Company tab - so
 * `/company_info` renders this with `initialTab="company"` rather than
 * duplicating the screen.
 */
export async function SettingsScreen({ initialTab }: { initialTab?: string } = {}) {
  await authorize('setting.index');

  const [
    setting,
    businessRows,
    emailTemplateRows,
    smsTemplateRows,
    smsGatewayRows,
    dateFormatRows,
    timeZoneRows,
    currencyRows,
    languageRows,
  ] = await Promise.all([
    generalSetting(),
    activationSettings(),
    templatesFor('email'),
    templatesFor('sms'),
    allSmsGateways(),
    allDateFormats(),
    allTimeZones(),
    allCurrencies(),
    activeLanguages(),
  ]);

  const [
    canActivation,
    canGeneral,
    canCompany,
    canInvoice,
    canSmtp,
    canSms,
    canEmailTemplate,
    canSmsTemplate,
  ] = await Promise.all([
    can('update_activation_status'),
    can('general_settings.index'),
    can('company_information_update'),
    can('invoice_settings.index'),
    can('smtp_gateway_credentials_update'),
    can('sms_gateway_credentials_update'),
    can('email_template.index'),
    can('sms_template.index'),
  ]);

  const canTestMail = await can('test_mail.send');
  const canTestSms = await can('sms_send_demo');

  const env = {
    MAIL_FROM_NAME: envValue('MAIL_FROM_NAME'),
    MAIL_FROM_ADDRESS: envValue('MAIL_FROM_ADDRESS'),
    MAIL_HOST: envValue('MAIL_HOST'),
    MAIL_PORT: envValue('MAIL_PORT'),
    MAIL_USERNAME: envValue('MAIL_USERNAME'),
    MAIL_PASSWORD: envValue('MAIL_PASSWORD'),
    MAIL_ENCRYPTION: envValue('MAIL_ENCRYPTION'),
    SENDER_MAIL: envValue('SENDER_MAIL'),
    TWILIO_SID: envValue('TWILIO_SID'),
    TWILIO_TOKEN: envValue('TWILIO_TOKEN'),
    VALID_TWILLO_NUMBER: envValue('VALID_TWILLO_NUMBER'),
    TEXT_TO_LOCAL_API_KEY: envValue('TEXT_TO_LOCAL_API_KEY'),
    TEXT_TO_LOCAL_SENDER: envValue('TEXT_TO_LOCAL_SENDER'),
  };

  const tabs: TabItem[] = [];

  if (canActivation) {
    tabs.push({
      id: 'activation',
      label: 'Activation',
      content: (
        <Card title="Activation" desc="What this installation does automatically.">
          {businessRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No business settings.</p>
          ) : (
            <div className="space-y-6">
              {businessRows.map((row) => (
                <SettingsRow
                  key={row.id}
                  title={settingTitle(row.type)}
                  description={
                    SETTING_DESCRIPTION[(row.type ?? '').toLowerCase()] ??
                    `Turns ${typeLabel(row.type).toLowerCase()} on for the whole business.`
                  }
                  control={
                    <form action={toggleBusinessSetting}>
                      <input type="hidden" name="id" value={row.id} />
                      <ToggleSwitch checked={row.status === 1} />
                    </form>
                  }
                />
              ))}
            </div>
          )}
        </Card>
      ),
    });
  }

  if (canGeneral) {
    tabs.push({
      id: 'general',
      label: 'General',
      content: (
        <Card><SettingsSection title="General" description="Brand identity, language, currency and regional defaults for your workspace.">
          <GeneralSettingsForm
            setting={{
              siteTitle: setting.siteTitle ?? '',
              fileSupported: setting.fileSupported ?? '',
              copyrightText: setting.copyrightText ?? '',
              languageId: String(setting.languageId ?? ''),
              dateFormatId: String(setting.dateFormatId ?? ''),
              currencyId: String(setting.currency ?? ''),
              timeZoneId: String(setting.timeZoneId ?? ''),
              currencySymbol: setting.currencySymbol ?? '',
              currencyCode: setting.currencyCode ?? '',
              preloader: setting.preloader ?? 'infix',
              paymentGateway: String(setting.paymentGateway ?? 1),
            }}
            logoUrl={uploadedAssetUrl(setting.logo) ?? '/images/logo/logo.svg'}
            faviconUrl={uploadedAssetUrl(setting.favicon) ?? '/images/logo/logo-icon.svg'}
            languages={languageRows.map((l) => ({ value: l.id, label: l.name }))}
            dateFormats={dateFormatRows.map((d) => ({
              value: d.id,
              label: d.normalView ?? d.format ?? String(d.id),
            }))}
            currencies={currencyRows.map((c) => ({ value: c.id, label: c.name ?? '' }))}
            timeZones={timeZoneRows.map((t) => ({
              value: t.id,
              label: t.timeZone ?? String(t.id),
            }))}
          />
        </SettingsSection></Card>
      ),
    });
  }

  if (canCompany) {
    tabs.push({
      id: 'company',
      label: 'Company Information',
      content: (
        <Card><SettingsSection title="Company Information" description="Business details used on your documents and correspondence.">
          <CompanyInformationForm
            setting={{
              companyName: setting.companyName ?? '',
              email: setting.email ?? '',
              phone: setting.phone ?? '',
              vatNumber: setting.vatNumber ?? '',
              address: setting.address ?? '',
              countryName: setting.countryName ?? '',
              zipCode: setting.zipCode ?? '',
              companyInfo: setting.companyInfo ?? '',
            }}
          />
        </SettingsSection></Card>
      ),
    });
  }

  if (canInvoice) {
    tabs.push({
      id: 'invoice',
      label: 'Invoice Settings',
      content: (
        <Card><SettingsSection title="Invoice Settings" description="Choose what appears on customer invoices.">
          <InvoiceSettingsForm
            setting={{
              remarksTitle: setting.remarksTitle ?? '',
              remarksBody: setting.remarksBody ?? '',
              termsConditions: setting.termsConditions ?? '',
            }}
          />
        </SettingsSection></Card>
      ),
    });
  }

  if (canSmtp) {
    tabs.push({
      id: 'smtp',
      label: 'SMTP',
      content: (
        <div className="space-y-5">
          <Card><SettingsSection title="SMTP Settings" description="Configure the email service used for outgoing messages.">
            <SmtpSettingsForm
              mailProtocol={setting.mailProtocol ?? 'smtp'}
              mailSignature={setting.mailSignature ?? ''}
              env={env}
            />
          </SettingsSection></Card>
          {canTestMail ? (
            <Card><SettingsSection title="Send Test Mail" description="Verify delivery using the saved email settings.">
              <TestMailForm />
            </SettingsSection></Card>
          ) : null}
        </div>
      ),
    });
  }

  if (canSms) {
    tabs.push({
      id: 'sms',
      label: 'SMS',
      content: (
        <div className="space-y-5">
          <Card><SettingsSection title="SMS Settings" description="Configure the SMS service used for outgoing messages.">
            <SmsSettingsForm
              gateways={smsGatewayRows.map((g) => ({ id: g.id, name: g.name }))}
              activeGatewayId={String(
                smsGatewayRows.find((g) => g.status === 1)?.id ?? '',
              )}
              env={env}
            />
          </SettingsSection></Card>
          {canTestSms ? (
            <Card><SettingsSection title="Send Test SMS" description="Verify delivery using the saved SMS settings.">
              <TestSmsForm />
            </SettingsSection></Card>
          ) : null}
        </div>
      ),
    });
  }

  if (canEmailTemplate) {
    tabs.push({
      id: 'email-template',
      label: 'Email Template',
      content: (
        <div className="space-y-5">
          {emailTemplateRows.map((template) => (
            <Card key={template.id} title={typeLabel(template.type)}>
              <TemplateForm
                type={template.type ?? ''}
                subject={template.subject ?? ''}
                value={template.value ?? ''}
                availableVariable={template.availableVariable ?? ''}
                isSms={false}
              />
            </Card>
          ))}
          <Card><SettingsSection title="Email Footer" description="The signature appended to outgoing emails.">
            <MailFooterForm mailFooter={setting.mailFooter ?? ''} />
          </SettingsSection></Card>
        </div>
      ),
    });
  }

  if (canSmsTemplate) {
    tabs.push({
      id: 'sms-template',
      label: 'SMS Template',
      content: (
        <div className="space-y-5">
          {smsTemplateRows.map((template) => (
            <Card key={template.id} title={typeLabel(template.type)}>
              <TemplateForm
                type={template.type ?? ''}
                subject={template.subject ?? ''}
                value={template.value ?? ''}
                availableVariable={template.availableVariable ?? ''}
                isSms
              />
            </Card>
          ))}
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader title="Settings" breadcrumb={[{ label: 'Settings' }]} />
      {tabs.length ? (
        <Tabs tabs={tabs} initial={initialTab} />
      ) : (
        <Card title="Settings">
          <p className="text-sm text-muted-foreground">
            You do not have access to any settings section.
          </p>
        </Card>
      )}
    </>
  );
}

export default async function SettingsPage() {
  return <SettingsScreen />;
}
