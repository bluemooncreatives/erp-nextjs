// ---------------------------------------------------------------------------
// Mail - ports app/Mail/SendMail.php, SendSmtpMail.php, TestSmtpMail.php and
// the two notifications (PasswordResetNotification, VerifyEmail).
//
// Transport settings come from the same MAIL_* keys in .env that Laravel used,
// with the database's `general_settings` overriding them the way the PHP
// GeneralSettingsController's SMTP form did.
//
// Message bodies come from the `email_templates` table, whose `value` column
// holds HTML with {PLACEHOLDER} tokens listed in `available_variable`.
// ---------------------------------------------------------------------------

import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { emailTemplates } from '@/lib/db/schema';
import { config } from '@/lib/config';
import { generalSetting } from '@/lib/settings';

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;

  if (config.mail.mailer === 'sendmail') {
    transporter = nodemailer.createTransport({ sendmail: true, newline: 'unix' });
  } else if (config.mail.mailer === 'log' || !config.mail.host) {
    // Laravel's `log` mailer - write the message instead of sending it.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.encryption === 'ssl' || config.mail.port === 465,
      auth: config.mail.username
        ? { user: config.mail.username, pass: config.mail.password }
        : undefined,
    });
  }
  return transporter;
}

export type MailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>;
};

export async function sendMail(message: MailMessage): Promise<boolean> {
  const setting = await generalSetting();
  const from =
    message.from ?? `"${config.mail.fromName}" <${config.mail.fromAddress}>`;

  // `mail_header` / `mail_footer` / `mail_signature` wrapped every outgoing
  // message in the PHP stack's markdown mail layout.
  const html = [
    setting.mailHeader ?? '',
    message.html,
    setting.mailSignature ? `<p>${setting.mailSignature}</p>` : '',
    setting.mailFooter ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await getTransport().sendMail({
      from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      html,
      attachments: message.attachments,
    });
    return true;
  } catch (error) {
    console.error('[mail] send failed', error);
    return false;
  }
}

/** Template types seeded by the installer, referenced by the PHP controllers. */
export const EmailTemplateType = {
  Quotation: 'quotation_template',
  Sale: 'sale_template',
  Purchase: 'purchase_template',
  Payment: 'payment_template',
  Contact: 'contact_template',
  PasswordReset: 'password_reset_template',
  VerifyEmail: 'verify_email_template',
} as const;

export async function loadTemplate(
  type: string,
  channel: 'email' | 'sms' = 'email',
) {
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.type, type), eq(emailTemplates.for, channel)))
    .limit(1);
  return row ?? null;
}

/** Substitute `{TOKEN}` placeholders the way the PHP templates expected. */
export function renderTemplate(
  body: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  let out = body;
  for (const [key, value] of Object.entries(variables)) {
    const token = key.startsWith('{') ? key : `{${key}}`;
    out = out.split(token).join(value == null ? '' : String(value));
  }
  return out;
}

/**
 * Send one of the database templates, falling back to `fallbackHtml` when the
 * row is missing or disabled - matching the PHP controllers, which skipped the
 * mail entirely when `status` was 0.
 */
export async function sendTemplateMail(options: {
  type: string;
  to: string | string[];
  variables?: Record<string, string | number | null | undefined>;
  subjectOverride?: string;
  fallbackHtml?: string;
  attachments?: MailMessage['attachments'];
}): Promise<boolean> {
  const template = await loadTemplate(options.type);
  if (template && !template.status) return false;

  const html = template?.value
    ? renderTemplate(template.value, options.variables ?? {})
    : options.fallbackHtml;
  if (!html) return false;

  return sendMail({
    to: options.to,
    subject: options.subjectOverride ?? template?.subject ?? config.app.name,
    html,
    attachments: options.attachments,
  });
}

/** `PasswordResetNotification` */
export async function sendPasswordResetMail(email: string, token: string) {
  const url = `${config.app.url}/password/reset/${token}?email=${encodeURIComponent(email)}`;
  return sendTemplateMail({
    type: EmailTemplateType.PasswordReset,
    to: email,
    variables: { RESET_URL: url, USER_EMAIL: email },
    subjectOverride: 'Reset Password Notification',
    fallbackHtml: `
      <p>You are receiving this email because we received a password reset
      request for your account.</p>
      <p><a href="${url}">Reset Password</a></p>
      <p>This password reset link will expire in 60 minutes.</p>
      <p>If you did not request a password reset, no further action is required.</p>
    `,
  });
}

/** `VerifyEmail` notification */
export async function sendVerifyEmailMail(email: string, verifyUrl: string) {
  return sendTemplateMail({
    type: EmailTemplateType.VerifyEmail,
    to: email,
    variables: { VERIFY_URL: verifyUrl, USER_EMAIL: email },
    subjectOverride: 'Verify Email Address',
    fallbackHtml: `
      <p>Please click the button below to verify your email address.</p>
      <p><a href="${verifyUrl}">Verify Email Address</a></p>
      <p>If you did not create an account, no further action is required.</p>
    `,
  });
}

/** `TestSmtpMail` - the Settings screen's "Test Mail" button. */
export async function sendTestMail(to: string): Promise<boolean> {
  return sendMail({
    to,
    subject: `${config.app.name} - SMTP test`,
    html: '<p>This is a test message confirming your mail configuration works.</p>',
  });
}

/**
 * `SaleController@send_mail_quotation($id)` - mails the invoice to the customer
 * from the `sale_template` row, substituting the same tokens the PHP did.
 *
 * The PHP attached a dompdf rendering of `sale::sale.pdf`; there is no PDF
 * engine here, so the message carries a link to the invoice's print view
 * instead of an attachment.
 */
export async function sendSaleMail(options: {
  to: string;
  customerName: string;
  invoiceNo: string;
  invoiceUrl: string;
}): Promise<boolean> {
  const setting = await generalSetting();

  return sendTemplateMail({
    type: EmailTemplateType.Sale,
    to: options.to,
    variables: {
      USER_FIRST_NAME: options.customerName,
      EMAIL_SIGNATURE: setting.mailSignature ?? '',
      EMAIL_FOOTER: setting.mailFooter ?? '',
      INVOICE_NO: options.invoiceNo,
      INVOICE_URL: options.invoiceUrl,
    },
    fallbackHtml: `
      <p>Dear ${options.customerName},</p>
      <p>Your invoice ${options.invoiceNo} is ready.</p>
      <p><a href="${options.invoiceUrl}">View the invoice</a></p>
    `,
  });
}

/**
 * `QuotationController@send_mail_quotation($id)` - the quotation equivalent of
 * `sendSaleMail`, from the `quotation_template` row.
 */
export async function sendQuotationMail(options: {
  to: string;
  customerName: string;
  invoiceNo: string;
  quotationUrl: string;
}): Promise<boolean> {
  const setting = await generalSetting();

  return sendTemplateMail({
    type: EmailTemplateType.Quotation,
    to: options.to,
    variables: {
      USER_FIRST_NAME: options.customerName,
      USER_LOGIN_EMAIL: options.to,
      EMAIL_SIGNATURE: setting.mailSignature ?? '',
      EMAIL_FOOTER: setting.mailFooter ?? '',
      INVOICE_NO: options.invoiceNo,
      QUOTATION_URL: options.quotationUrl,
    },
    fallbackHtml: `
      <p>Dear ${options.customerName},</p>
      <p>Your quotation ${options.invoiceNo} is ready.</p>
      <p><a href="${options.quotationUrl}">View the quotation</a></p>
    `,
  });
}
