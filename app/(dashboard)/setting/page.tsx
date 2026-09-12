// Settings - port of Modules/Setting `setting::index` and its page components.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
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
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Tabs, type TabItem } from '@/components/erp/tabs';
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

export default async function SettingsPage() {
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
        <Card title="Activation" bodyClassName="">
          <DataTable
            columns={[{ label: 'Sl' }, { label: 'Type' }, { label: 'Activate' }]}
            isEmpty={businessRows.length === 0}
            empty="No business settings."
          >
            {businessRows.map((row, index) => (
              <Tr key={row.id}>
                <Td>{index + 1}</Td>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {typeLabel(row.type)}
                </Td>
                <Td>
                  <form action={toggleBusinessSetting}>
                    <input type="hidden" name="id" value={row.id} />
                    <ToggleSwitch checked={row.status === 1} />
                  </form>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      ),
    });
  }

  if (canGeneral) {
    tabs.push({
      id: 'general',
      label: 'General',
      content: (
        <Card title="General">
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
            logoUrl={assetUrl(setting.logo) ?? '/images/logo/logo.svg'}
            faviconUrl={assetUrl(setting.favicon) ?? '/images/logo/logo-icon.svg'}
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
        </Card>
      ),
    });
  }

  if (canCompany) {
    tabs.push({
      id: 'company',
      label: 'Company Information',
      content: (
        <Card title="Company Information">
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
        </Card>
      ),
    });
  }

  if (canInvoice) {
    tabs.push({
      id: 'invoice',
      label: 'Invoice Settings',
      content: (
        <Card title="Invoice Settings">
          <InvoiceSettingsForm
            setting={{
              remarksTitle: setting.remarksTitle ?? '',
              remarksBody: setting.remarksBody ?? '',
              termsConditions: setting.termsConditions ?? '',
            }}
          />
        </Card>
      ),
    });
  }

  if (canSmtp) {
    tabs.push({
      id: 'smtp',
      label: 'SMTP',
      content: (
        <div className="space-y-5">
          <Card title="SMTP Settings">
            <SmtpSettingsForm
              mailProtocol={setting.mailProtocol ?? 'smtp'}
              mailSignature={setting.mailSignature ?? ''}
              env={env}
            />
          </Card>
          {canTestMail ? (
            <Card title="Send Test Mail">
              <TestMailForm />
            </Card>
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
          <Card title="SMS Settings">
            <SmsSettingsForm
              gateways={smsGatewayRows.map((g) => ({ id: g.id, name: g.name }))}
              activeGatewayId={String(
                smsGatewayRows.find((g) => g.status === 1)?.id ?? '',
              )}
              env={env}
            />
          </Card>
          {canTestSms ? (
            <Card title="Send Test SMS">
              <TestSmsForm />
            </Card>
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
          <Card title="Email Footer">
            <MailFooterForm mailFooter={setting.mailFooter ?? ''} />
          </Card>
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
        <Tabs tabs={tabs} />
      ) : (
        <Card title="Settings">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You do not have access to any settings section.
          </p>
        </Card>
      )}
    </>
  );
}
