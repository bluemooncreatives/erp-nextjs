'use server';

// Contact server actions - port of Modules/Contact/Http/Controllers/ContactController.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { fileFrom, saveAvatar } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';
import {
  createContact,
  deleteContact,
  setContactActive,
  updateContact,
  type ContactInput,
} from '@/lib/contact/repository';
import { generalSetting } from '@/lib/settings';

export type ContactFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

/** `ContactFormRequest` - name and contact type are required. */
async function validate(
  formData: FormData,
  isUpdate: boolean,
): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {};

  if (!str(formData, 'name')) errors.name = 'The name field is required.';
  if (!str(formData, 'contact_type')) {
    errors.contact_type = 'The contact type field is required.';
  }

  const email = str(formData, 'email');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.email = 'The email must be a valid email address.';
  }

  // A login is only created when `contact_login` is enabled, and only then does
  // the password matter.
  const setting = await generalSetting();
  if (setting.contactLogin && !isUpdate) {
    if (!email) errors.email = 'An email is required to create the contact login.';
    const password = str(formData, 'password');
    if (!password) {
      errors.password = 'The password field is required.';
    } else if (password.length < 8) {
      errors.password = 'The password must be at least 8 characters.';
    }
  }

  return Object.keys(errors).length ? errors : null;
}

async function readInput(formData: FormData): Promise<ContactInput> {
  const avatar = await saveAvatar(fileFrom(formData, 'file'));

  return {
    contactType: (str(formData, 'contact_type') ?? 'Customer') as 'Customer' | 'Supplier',
    name: String(formData.get('name') ?? '').trim(),
    businessName: str(formData, 'business_name'),
    taxNumber: str(formData, 'tax_number'),
    openingBalance: str(formData, 'opening_balance') ?? '0',
    payTerm: str(formData, 'pay_term'),
    payTermCondition: str(formData, 'pay_term_condition') ?? '',
    customerGroup: str(formData, 'customer_group'),
    creditLimit: str(formData, 'credit_limit'),
    email: str(formData, 'email'),
    username: str(formData, 'username'),
    mobile: str(formData, 'mobile'),
    alternateContactNo: str(formData, 'alternate_contact_no'),
    countryId: formData.get('country_id') ? Number(formData.get('country_id')) : null,
    state: str(formData, 'state'),
    city: str(formData, 'city'),
    note: str(formData, 'note'),
    address: str(formData, 'address'),
    avatar,
    password: str(formData, 'password'),
  };
}

export async function storeContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const fieldErrors = await validate(formData, false);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize('add_contact.store');

  try {
    const input = await readInput(formData);
    await createContact(input, user.id);
    await successLog(`Contact created: ${input.name}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['add_contact.index']);
  redirect(ROUTES['add_contact.index']);
}

export async function updateContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return { error: 'Missing contact id.' };

  const fieldErrors = await validate(formData, true);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize('add_contact.edit');

  try {
    const input = await readInput(formData);
    await updateContact(id, input, user.id);
    await successLog(`Contact updated: ${input.name}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['add_contact.index']);
  redirect(ROUTES['add_contact.index']);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('add_contact.destroy');

  const result = await deleteContact(id);
  if (result.ok) {
    await successLog(`Contact deleted: ${id}`, user.id);
  } else {
    await errorLog(`Contact ${id} not deleted - ${result.message}`, user.id);
  }

  revalidatePath(ROUTES['add_contact.index']);
}

/** `statusChange()` - the active/inactive toggle on the contact list. */
export async function toggleContactActive(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const isActive = Number(formData.get('is_active'));
  const user = await authorize('add_contact.edit');

  await setContactActive(id, isActive ? 0 : 1);
  await successLog(`Contact ${id} status changed`, user.id);

  revalidatePath(ROUTES['add_contact.index']);
  revalidatePath(ROUTES['customer']);
  revalidatePath(ROUTES['supplier']);
}
