'use server';

// ---------------------------------------------------------------------------
// Setup + Location server actions - ports of ShowRoomController,
// WareHouseController, TaxController, IntroPrefixController, CurrencyController,
// CountryController and DepartmentController.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { departmentRepository, taxRepository } from '@/lib/product/repositories';
import {
  countryRepository,
  createShowRoomWithAccount,
  currencyRepository,
  introPrefixRepository,
  showRoomInUse,
  showRoomRepository,
  updateShowRoom,
  wareHouseInUse,
  wareHouseRepository,
} from '@/lib/setup/repositories';
import type { ReferenceFormState } from '@/components/erp/reference-crud';

function read(formData: FormData) {
  return {
    id: formData.get('id') ? Number(formData.get('id')) : null,
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    status: Number(formData.get('status') ?? 1),
  };
}

function requireName(name: string): Record<string, string> | null {
  return name ? null : { name: 'The name field is required.' };
}

// --- Branch (ShowRoom) -----------------------------------------------------

export async function saveShowRoom(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = read(formData);
  const fieldErrors = requireName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'showroom.edit' : 'showroom.store');

  const values = {
    name: data.name,
    email: String(formData.get('email') ?? '').trim() || null,
    address: String(formData.get('address') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    status: data.status,
  };

  try {
    if (data.id) {
      await updateShowRoom(data.id, values, user.id);
      revalidatePath(ROUTES['showroom.index']);
      return { success: 'Branch Updated Successfully' };
    }
    await createShowRoomWithAccount(values, user.id);
    revalidatePath(ROUTES['showroom.index']);
    return { success: 'Branch Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteShowRoom(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('showroom.destroy');

  const blocked = await showRoomInUse(id);
  if (blocked) {
    await errorLog(`Branch ${id} not deleted - ${blocked}`, user.id);
    return;
  }
  await showRoomRepository.remove(id);
  await successLog(`Branch deleted: ${id}`, user.id);
  revalidatePath(ROUTES['showroom.index']);
}

// --- Warehouse -------------------------------------------------------------

export async function saveWareHouse(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = read(formData);
  const fieldErrors = requireName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'warehouse.edit' : 'warehouse.store');

  const values = {
    name: data.name,
    email: String(formData.get('email') ?? '').trim() || null,
    address: String(formData.get('address') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    status: data.status,
  };

  try {
    if (data.id) {
      await wareHouseRepository.update(data.id, values, user.id);
      revalidatePath(ROUTES['warehouse.index']);
      return { success: 'Warehouse Updated Successfully' };
    }
    await wareHouseRepository.create(values, user.id);
    revalidatePath(ROUTES['warehouse.index']);
    return { success: 'Warehouse Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteWareHouse(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('warehouse.destroy');

  const blocked = await wareHouseInUse(id);
  if (blocked) {
    await errorLog(`Warehouse ${id} not deleted - ${blocked}`, user.id);
    return;
  }
  await wareHouseRepository.remove(id);
  revalidatePath(ROUTES['warehouse.index']);
}

// --- Tax -------------------------------------------------------------------

export async function saveTax(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = read(formData);
  const fieldErrors = requireName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'tax.edit' : 'tax.store');

  const values = {
    name: data.name,
    description: data.description,
    rate: Number(formData.get('rate') ?? 0),
    status: data.status,
  };

  try {
    if (data.id) {
      await taxRepository.update(data.id, values, user.id);
      revalidatePath(ROUTES['tax.index']);
      return { success: 'Tax Updated Successfully' };
    }
    await taxRepository.create(values, user.id);
    revalidatePath(ROUTES['tax.index']);
    return { success: 'Tax Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteTax(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('tax.destroy');
  await taxRepository.remove(id);
  revalidatePath(ROUTES['tax.index']);
}

// --- Intro prefix ----------------------------------------------------------

export async function saveIntroPrefix(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const prefix = String(formData.get('name') ?? '').trim();
  const title = String(formData.get('description') ?? '').trim();

  if (!prefix) return { fieldErrors: { name: 'The prefix field is required.' } };

  const user = await authorize(id ? 'introPrefix.edit' : 'introPrefix.store');

  try {
    const values = { prefix, title };
    if (id) {
      await introPrefixRepository.update(id, values, user.id);
      revalidatePath(ROUTES['introPrefix.index']);
      return { success: 'Prefix Updated Successfully' };
    }
    await introPrefixRepository.create(values, user.id);
    revalidatePath(ROUTES['introPrefix.index']);
    return { success: 'Prefix Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteIntroPrefix(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('introPrefix.destroy');
  await introPrefixRepository.remove(id);
  revalidatePath(ROUTES['introPrefix.index']);
}

// --- Currency --------------------------------------------------------------

export async function saveCurrency(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const symbol = String(formData.get('symbol') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The name field is required.';
  if (!code) fieldErrors.code = 'The code field is required.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const user = await authorize(id ? 'currencies.edit' : 'currencies.store');

  try {
    const values = { name, code, symbol };
    if (id) {
      await currencyRepository.update(id, values, user.id);
      revalidatePath(ROUTES['currencies.index']);
      return { success: 'Currency Updated Successfully' };
    }
    await currencyRepository.create(values, user.id);
    revalidatePath(ROUTES['currencies.index']);
    return { success: 'Currency Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteCurrency(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('currencies.delete');
  await currencyRepository.remove(id);
  revalidatePath(ROUTES['currencies.index']);
}

// --- Country ---------------------------------------------------------------

export async function saveCountry(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { fieldErrors: { name: 'The name field is required.' } };

  const user = await authorize('country.index');

  try {
    const values = {
      name,
      iso2: String(formData.get('iso2') ?? '').trim() || null,
      iso3: String(formData.get('iso3') ?? '').trim() || null,
      phonecode: String(formData.get('phonecode') ?? '').trim() || null,
      currency: String(formData.get('currency') ?? '').trim() || null,
      capital: String(formData.get('capital') ?? '').trim() || null,
      activeStatus: Number(formData.get('status') ?? 1),
    };
    if (id) {
      await countryRepository.update(id, values, user.id);
      revalidatePath(ROUTES['country.index']);
      return { success: 'Country Updated Successfully' };
    }
    await countryRepository.create(values, user.id);
    revalidatePath(ROUTES['country.index']);
    return { success: 'Country Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteCountry(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('country.index');
  await countryRepository.remove(id);
  revalidatePath(ROUTES['country.index']);
}

// --- Department ------------------------------------------------------------

export async function saveDepartment(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = read(formData);
  const fieldErrors = requireName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'departments.edit' : 'departments.store');

  try {
    const values = { name: data.name, details: data.description, status: data.status };
    if (data.id) {
      await departmentRepository.update(data.id, values, user.id);
      revalidatePath(ROUTES['departments.index']);
      return { success: 'Department Updated Successfully' };
    }
    await departmentRepository.create(values, user.id);
    revalidatePath(ROUTES['departments.index']);
    return { success: 'Department Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteDepartment(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('departments.delete');
  await departmentRepository.remove(id);
  revalidatePath(ROUTES['departments.index']);
}
