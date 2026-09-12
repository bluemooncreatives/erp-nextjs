// ---------------------------------------------------------------------------
// SMS - port of app/Traits/SendSMS.php.
//
// The gateway is chosen by whichever row in `sms_gateways` has status = 1,
// in the same order the PHP trait checked: Twilio first, then Text to Local.
// Credentials still come from the same .env keys.
// ---------------------------------------------------------------------------

import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { smsGateways } from '@/lib/db/schema';

async function activeGateway(): Promise<string | null> {
  const rows = await db
    .select({ name: smsGateways.name })
    .from(smsGateways)
    .where(eq(smsGateways.status, 1));
  const names = rows.map((r) => r.name);
  if (names.includes('Twillo')) return 'Twillo';
  if (names.includes('Text to Local')) return 'Text to Local';
  return null;
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  const gateway = await activeGateway();
  if (!gateway) return false;

  try {
    if (gateway === 'Twillo') return await sendViaTwilio(to, text);
    return await sendViaTextLocal(to, text);
  } catch (error) {
    // The PHP trait swallowed gateway errors; keep that behaviour but log.
    console.error('[sms] send failed', error);
    return false;
  }
}

async function sendViaTwilio(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.VALID_TWILLO_NUMBER;
  if (!sid || !token || !from) return false;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  return response.ok;
}

async function sendViaTextLocal(to: string, text: string): Promise<boolean> {
  const apiKey = process.env.TEXT_TO_LOCAL_API_KEY;
  const sender = process.env.TEXT_TO_LOCAL_SENDER;
  if (!apiKey) return false;

  const response = await fetch('https://api.txtlocal.com/send/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      apikey: apiKey,
      numbers: to,
      sender: sender ?? '',
      message: text,
    }),
  });
  return response.ok;
}

/**
 * `sendIndividualSMS()` used the onnorokomSMS SOAP endpoint. That service takes
 * the same parameters over its REST bridge, which is what is used here.
 */
export async function sendIndividualSms(number: string, text: string): Promise<boolean> {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) return false;

  try {
    const response = await fetch('https://api2.onnorokomsms.com/sendsms.asmx/NumberSms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apiKey,
        messageText: text,
        numberList: number,
        smsType: 'TEXT',
        maskName: '',
        campaignName: '',
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('[sms] individual send failed', error);
    return false;
  }
}
