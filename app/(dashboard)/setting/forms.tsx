'use client';

// The Settings screen's forms - one per Blade partial under
// Modules/Setting/Resources/views/page_components.

import { useActionState } from 'react';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  FormRadio,
  FormActions,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import {
  updateGeneralSettings,
  updateInvoiceSettings,
  updateSmtpCredentials,
  updateSmsCredentials,
  updateEmailTemplate,
  updateMailFooter,
  sendTestMailAction,
  sendTestSmsAction,
  updateGuestBackground,
  changeDefaultView,
  updatePaymentGateway,
  removeSettingImage,
  type SettingFormState,
} from './actions';

const EMPTY: SettingFormState = {};

function Messages({ state }: { state: SettingFormState }) {
  return (
    <>
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />
    </>
  );
}

/** `general_settings.blade.php` */
export function GeneralSettingsForm({
  setting,
  logoUrl,
  faviconUrl,
  languages,
  dateFormats,
  currencies,
  timeZones,
}: {
  setting: {
    siteTitle: string;
    fileSupported: string;
    copyrightText: string;
    languageId: string;
    dateFormatId: string;
    currencyId: string;
    timeZoneId: string;
    currencySymbol: string;
    currencyCode: string;
    preloader: string;
    paymentGateway: string;
  };
  logoUrl: string;
  faviconUrl: string;
  languages: SelectOption[];
  dateFormats: SelectOption[];
  currencies: SelectOption[];
  timeZones: SelectOption[];
}) {
  const [state, action] = useActionState(updateGeneralSettings, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <ImageField
          title="System Logo"
          name="site_logo"
          url={logoUrl}
          removeType="logo"
        />
        <ImageField
          title="Fav Icon"
          name="favicon_logo"
          url={faviconUrl}
          removeType="favicon"
        />
      </div>

      <FormInput
        label="System Title"
        name="site_title"
        defaultValue={setting.siteTitle}
        placeholder="Infix CRM"
        required
        error={state.fieldErrors?.site_title}
      />

      <FormInput
        label="File Supported"
        hint="Include comma with each word"
        name="file_supported"
        defaultValue={setting.fileSupported}
        placeholder="jpg,png,pdf"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          label="System Default Language"
          name="language_id"
          defaultValue={setting.languageId}
          options={languages}
          required
          error={state.fieldErrors?.language_id}
        />
        <FormSelect
          label="Date Format"
          name="date_format_id"
          defaultValue={setting.dateFormatId}
          options={dateFormats}
          required
          error={state.fieldErrors?.date_format_id}
        />
        <FormSelect
          label="System Default Currency"
          name="currency_id"
          defaultValue={setting.currencyId}
          options={currencies}
          required
          error={state.fieldErrors?.currency_id}
        />
        <FormSelect
          label="Time Zone"
          name="time_zone_id"
          defaultValue={setting.timeZoneId}
          options={timeZones}
          required
          error={state.fieldErrors?.time_zone_id}
        />
        <FormInput
          label="Currency Symbol"
          name="currency_symbol"
          defaultValue={setting.currencySymbol}
          readOnly
        />
        <FormInput
          label="Currency Code"
          name="currency_code"
          defaultValue={setting.currencyCode}
          readOnly
        />
        <FormInput
          label="Preloader"
          name="preloader"
          defaultValue={setting.preloader}
          required
          error={state.fieldErrors?.preloader}
        />
        <FormSelect
          label="Default Payment"
          name="payment_gateway"
          defaultValue={setting.paymentGateway}
          options={[
            { value: '1', label: 'Cash' },
            { value: '2', label: 'Bank' },
          ]}
        />
      </div>

      <FormInput
        label="Copywrite Text"
        name="copyright_text"
        defaultValue={setting.copyrightText}
      />

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

function ImageField({
  title,
  name,
  url,
  removeType,
}: {
  title: string;
  name: string;
  url: string;
  removeType: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-5 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="my-4 flex h-24 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} className="max-h-24 w-auto" />
      </div>
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/jpg"
        className="mx-auto block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
      />
      <RemoveImageButton type={removeType} />
    </div>
  );
}

function RemoveImageButton({ type }: { type: string }) {
  return (
    <button
      type="button"
      onClick={async (event) => {
        event.preventDefault();
        if (!window.confirm('Remove this image?')) return;
        const data = new FormData();
        data.set('type', type);
        await removeSettingImage(data);
      }}
      className="mt-3 text-xs font-medium text-destructive hover:text-destructive"
    >
      Remove
    </button>
  );
}

/** `company_info_settings.blade.php` */
export function CompanyInformationForm({
  setting,
}: {
  setting: {
    companyName: string;
    email: string;
    phone: string;
    vatNumber: string;
    address: string;
    countryName: string;
    zipCode: string;
    companyInfo: string;
  };
}) {
  const [state, action] = useActionState(updateGeneralSettings, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="company" value="1" />
      <Messages state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="Company Name"
          name="company_name"
          defaultValue={setting.companyName}
        />
        <FormInput
          label="Email"
          name="email"
          type="email"
          defaultValue={setting.email}
          required
          error={state.fieldErrors?.email}
        />
        <FormInput
          label="Phone"
          name="phone"
          defaultValue={setting.phone}
          required
          error={state.fieldErrors?.phone}
        />
        <FormInput label="VAT Number" name="vat_number" defaultValue={setting.vatNumber} />
      </div>

      <FormInput
        label="Address"
        name="address"
        defaultValue={setting.address}
        required
        error={state.fieldErrors?.address}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput label="Country" name="country_name" defaultValue={setting.countryName} />
        <FormInput label="Zip Code" name="zip_code" defaultValue={setting.zipCode} />
      </div>

      <FormTextarea
        label="Company Information"
        name="company_info"
        rows={6}
        defaultValue={setting.companyInfo}
      />

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `invoice_settings.blade.php` */
export function InvoiceSettingsForm({
  setting,
}: {
  setting: { remarksTitle: string; remarksBody: string; termsConditions: string };
}) {
  const [state, action] = useActionState(updateInvoiceSettings, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <FormInput label="Remark Title" name="remarks_title" defaultValue={setting.remarksTitle} />
      <FormTextarea
        label="Remark Body"
        name="remarks_body"
        rows={5}
        defaultValue={setting.remarksBody}
      />
      <FormTextarea
        label="Terms & Condition"
        name="terms_conditions"
        rows={8}
        defaultValue={setting.termsConditions}
      />
      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `smtp_setting.blade.php` */
export function SmtpSettingsForm({
  mailProtocol,
  mailSignature,
  env,
}: {
  mailProtocol: string;
  mailSignature: string;
  env: Record<string, string>;
}) {
  const [state, action] = useActionState(updateSmtpCredentials, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />

      <FormSelect
        label="Email Protocol"
        name="mail_protocol"
        defaultValue={mailProtocol}
        options={[
          { value: 'smtp', label: 'SMTP' },
          { value: 'sendmail', label:'Send Mail' },
        ]}
        error={state.fieldErrors?.mail_protocol}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <EnvField label="From Name" name="MAIL_FROM_NAME" value={env.MAIL_FROM_NAME} />
        <EnvField
          label="From Mail"
          name="MAIL_FROM_ADDRESS"
          value={env.MAIL_FROM_ADDRESS}
          type="email"
        />
        <EnvField label="Mail Host" name="MAIL_HOST" value={env.MAIL_HOST} />
        <EnvField label="Mail Port" name="MAIL_PORT" value={env.MAIL_PORT} />
        <EnvField label="Mail Username" name="MAIL_USERNAME" value={env.MAIL_USERNAME} />
        <EnvField
          label="Mail Password"
          name="MAIL_PASSWORD"
          value={env.MAIL_PASSWORD}
          type="password"
        />
        <div>
          <input type="hidden" name="types" value="MAIL_ENCRYPTION" />
          <FormSelect
            label="Mail Encryption"
            name="MAIL_ENCRYPTION"
            defaultValue={env.MAIL_ENCRYPTION}
            options={[
              { value: 'ssl', label: 'SSL' },
              { value: 'tls', label: 'TLS' },
            ]}
          />
        </div>
        <EnvField label="Sender Email" name="SENDER_MAIL" value={env.SENDER_MAIL} />
      </div>

      <FormInput
        label="Mail Signature"
        name="mail_signature"
        defaultValue={mailSignature}
      />

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

function EnvField({
  label,
  name,
  value,
  type = 'text',
}: {
  label: string;
  name: string;
  value?: string;
  type?: string;
}) {
  return (
    <div>
      {/* `types[]` told the PHP which env keys this form owns. */}
      <input type="hidden" name="types" value={name} />
      <FormInput label={label} name={name} type={type} defaultValue={value ?? ''} />
    </div>
  );
}

export function TestMailForm() {
  const [state, action] = useActionState(sendTestMailAction, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <FormInput
        label="Send a Test Email to"
        name="email"
        placeholder="Email to"
        required
        error={state.fieldErrors?.email}
      />
      <FormInput
        label="Mail Text"
        name="content"
        required
        error={state.fieldErrors?.content}
      />
      <FormActions>
        <SubmitButton pendingLabel="Sending...">Send Test Mail</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `sms_settings.blade.php` */
export function SmsSettingsForm({
  gateways,
  activeGatewayId,
  env,
}: {
  gateways: Array<{ id: number; name: string }>;
  activeGatewayId: string;
  env: Record<string, string>;
}) {
  const [state, action] = useActionState(updateSmsCredentials, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Activate SMS Gateway
        </p>
        {gateways.map((gateway) => (
          <FormRadio
            key={gateway.id}
            name="sms_gateway_id"
            value={gateway.id}
            defaultChecked={String(gateway.id) === activeGatewayId}
            label={gateway.name}
          />
        ))}
        {state.fieldErrors?.sms_gateway_id ? (
          <p className="text-xs text-destructive">{state.fieldErrors.sms_gateway_id}</p>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-border p-5">
        <p className="text-sm font-medium text-foreground">
          Twilio Settings
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <EnvField label="Twilio Account SID" name="TWILIO_SID" value={env.TWILIO_SID} />
          <EnvField
            label="Authentication Token"
            name="TWILIO_TOKEN"
            value={env.TWILIO_TOKEN}
          />
          <EnvField
            label="Registered Phone Number"
            name="VALID_TWILLO_NUMBER"
            value={env.VALID_TWILLO_NUMBER}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border p-5">
        <p className="text-sm font-medium text-foreground">
          Text To Local Settings
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <EnvField
            label="API Key"
            name="TEXT_TO_LOCAL_API_KEY"
            value={env.TEXT_TO_LOCAL_API_KEY}
          />
          <EnvField
            label="Sender Name"
            name="TEXT_TO_LOCAL_SENDER"
            value={env.TEXT_TO_LOCAL_SENDER}
          />
        </div>
      </div>

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

export function TestSmsForm() {
  const [state, action] = useActionState(sendTestSmsAction, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <FormInput
        label="Send a Test SMS to"
        name="number"
        required
        error={state.fieldErrors?.number}
      />
      <FormInput label="Message" name="message" defaultValue="Test message" />
      <FormActions>
        <SubmitButton pendingLabel="Sending...">Send Test SMS</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `email_template.blade.php` / `sms_template.blade.php` */
export function TemplateForm({
  type,
  subject,
  value,
  availableVariable,
  isSms,
}: {
  type: string;
  subject: string;
  value: string;
  availableVariable: string;
  isSms: boolean;
}) {
  const [state, action] = useActionState(updateEmailTemplate, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="name" value={type} />
      {isSms ? <input type="hidden" name="sms_template" value="1" /> : null}
      <Messages state={state} />

      {isSms ? null : (
        <FormInput label="Subject" name="subject" defaultValue={subject} />
      )}

      <FormTextarea
        label={isSms ? 'Message Body' : 'Template Body'}
        name={type}
        rows={isSms ? 5 : 12}
        defaultValue={value}
      />

      {availableVariable ? (
        <div>
          <p className="text-sm font-medium text-foreground">
            Available Variables
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {availableVariable}
          </p>
        </div>
      ) : null}

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

export function MailFooterForm({ mailFooter }: { mailFooter: string }) {
  const [state, action] = useActionState(updateMailFooter, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <FormTextarea
        label="Email Footer"
        name="mail_footer"
        rows={5}
        defaultValue={mailFooter}
      />
      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `bg.blade.php` */
export function GuestBackgroundForm({
  loginBgUrl,
  errorBgUrl,
}: {
  loginBgUrl: string;
  errorBgUrl: string;
}) {
  const [state, action] = useActionState(updateGuestBackground, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-5 text-center">
          <p className="text-sm font-medium text-foreground">
            Login Background Image
          </p>
          <div className="my-4 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={loginBgUrl} alt="Login background" className="max-h-40 w-auto" />
          </div>
          <input
            type="file"
            name="login_bg"
            accept="image/*"
            className="mx-auto block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
          />
        </div>
        <div className="rounded-2xl border border-border p-5 text-center">
          <p className="text-sm font-medium text-foreground">
            Error Page Background Image
          </p>
          <div className="my-4 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={errorBgUrl} alt="Error page background" className="max-h-40 w-auto" />
          </div>
          <input
            type="file"
            name="error_page_bg"
            accept="image/*"
            className="mx-auto block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
          />
        </div>
      </div>
      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `themes/change_view.blade.php` */
export function ChangeViewForm({ defaultView }: { defaultView: string }) {
  const [state, action] = useActionState(changeDefaultView, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <div className="flex flex-wrap gap-6">
        <FormRadio
          name="view"
          value="normal"
          defaultChecked={defaultView === 'normal'}
          label="Normal View"
        />
        <FormRadio
          name="view"
          value="compact"
          defaultChecked={defaultView === 'compact'}
          label="Compact View"
        />
      </div>
      {state.fieldErrors?.view ? (
        <p className="text-xs text-destructive">{state.fieldErrors.view}</p>
      ) : null}
      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

/** `payment-method.blade.php` - the per-gateway credential form. */
export function PaymentGatewayForm({
  gateway,
}: {
  gateway: {
    id: number;
    gatewayName: string;
    gatewayUsername: string;
    gatewayApiKey: string;
    gatewaySecretKey: string;
    redirectUrl: string;
  };
}) {
  const [state, action] = useActionState(updatePaymentGateway, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={gateway.id} />
      <Messages state={state} />
      <FormInput label="Gateway name" name="gateway_name" defaultValue={gateway.gatewayName} />
      <FormInput
        label="Gateway username"
        name="gateway_username"
        defaultValue={gateway.gatewayUsername}
      />
      <FormInput
        label="Gateway api key"
        name="gateway_api_key"
        defaultValue={gateway.gatewayApiKey}
      />
      <FormInput
        label="Gateway secret key"
        name="gateway_secret_key"
        defaultValue={gateway.gatewaySecretKey}
      />
      <FormInput label="Redirect url" name="redirect_url" defaultValue={gateway.redirectUrl} />
      <FormActions>
        <SubmitButton>Update</SubmitButton>
      </FormActions>
    </form>
  );
}
