import { authorize } from '@/lib/auth/permissions';
import { generalSetting } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { saveContactSettings } from './actions';

export default async function ContactSettingsPage() {
  await authorize('contact.settings');
  const setting = await generalSetting();
  return <><PageHeader title="Contact Settings" /><Card title="Contact Login"><form action={saveContactSettings} className="max-w-lg space-y-5">
    <FormSelect label="Allow contact login" name="contact_login" defaultValue={setting.contactLogin ?? 0} options={[{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }]} />
    <SubmitButton>Save Settings</SubmitButton>
  </form></Card></>;
}
