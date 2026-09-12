'use server';

// ---------------------------------------------------------------------------
// Product module server actions - ports of BrandController, ModelController,
// UnitTypeController, CategoryController and VariantController.
//
// Each action re-checks its permission (`.store` for creates, `.edit` for
// updates, `.delete`/`.destroy` for removals) exactly as the `permission`
// middleware did, and logs failures the way the controllers' catch blocks did.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import {
  brandInUse,
  brandRepository,
  categoryInUse,
  categoryRepository,
  createVariantWithValues,
  modelInUse,
  modelRepository,
  unitTypeInUse,
  unitTypeRepository,
  updateVariantWithValues,
  variantInUse,
  variantRepository,
} from '@/lib/product/repositories';
import type { ReferenceFormState } from '@/components/erp/reference-crud';

function readCommon(formData: FormData) {
  return {
    id: formData.get('id') ? Number(formData.get('id')) : null,
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    status: Number(formData.get('status') ?? 1),
  };
}

/** The `BrandFormRequest` etc. all required a name. */
function validateName(name: string): Record<string, string> | null {
  if (!name) return { name: 'The name field is required.' };
  if (name.length > 50) return { name: 'The name may not be greater than 50 characters.' };
  return null;
}

// --- Brand -----------------------------------------------------------------

export async function saveBrand(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = readCommon(formData);
  const fieldErrors = validateName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'brand.edit' : 'brand.store');

  try {
    if (data.id) {
      await brandRepository.update(
        data.id,
        { name: data.name, description: data.description, status: data.status },
        user.id,
      );
      await successLog(`Brand updated: ${data.name}`, user.id);
      revalidatePath(ROUTES['brand.index']);
      return { success: 'Brand Updated Successfully' };
    }

    await brandRepository.create(
      { name: data.name, description: data.description, status: data.status },
      user.id,
    );
    await successLog(`Brand created: ${data.name}`, user.id);
    revalidatePath(ROUTES['brand.index']);
    return { success: 'Brand Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteBrand(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('brand.delete');

  if ((await brandInUse(id)) > 0) {
    await errorLog(`Brand ${id} could not be deleted - still used by products`, user.id);
    return;
  }
  await brandRepository.remove(id);
  await successLog(`Brand deleted: ${id}`, user.id);
  revalidatePath(ROUTES['brand.index']);
}

// --- Model -----------------------------------------------------------------

export async function saveModel(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = readCommon(formData);
  const fieldErrors = validateName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'model.edit' : 'model.store');

  try {
    const values = {
      name: data.name,
      description: data.description,
      status: data.status,
    };
    if (data.id) {
      await modelRepository.update(data.id, values, user.id);
      revalidatePath(ROUTES['model.index']);
      return { success: 'Model Updated Successfully' };
    }
    await modelRepository.create(values, user.id);
    revalidatePath(ROUTES['model.index']);
    return { success: 'Model Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteModel(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('model.delete');
  if ((await modelInUse(id)) > 0) {
    await errorLog(`Model ${id} could not be deleted - still used by products`, user.id);
    return;
  }
  await modelRepository.remove(id);
  revalidatePath(ROUTES['model.index']);
}

// --- Unit type -------------------------------------------------------------

export async function saveUnitType(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = readCommon(formData);
  const fieldErrors = validateName(data.name);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize(data.id ? 'unit_type.edit' : 'unit_type.store');

  try {
    const values = {
      name: data.name,
      description: data.description,
      status: data.status,
    };
    if (data.id) {
      await unitTypeRepository.update(data.id, values, user.id);
      revalidatePath(ROUTES['unit_type.index']);
      return { success: 'Unit Type Updated Successfully' };
    }
    await unitTypeRepository.create(values, user.id);
    revalidatePath(ROUTES['unit_type.index']);
    return { success: 'Unit Type Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteUnitType(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('unit_type.delete');
  if ((await unitTypeInUse(id)) > 0) {
    await errorLog(`Unit type ${id} could not be deleted - still in use`, user.id);
    return;
  }
  await unitTypeRepository.remove(id);
  revalidatePath(ROUTES['unit_type.index']);
}

// --- Category --------------------------------------------------------------

export async function saveCategory(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = readCommon(formData);
  const fieldErrors = validateName(data.name);
  if (fieldErrors) return { fieldErrors };

  const parentRaw = formData.get('parent_id');
  const parentId = parentRaw && String(parentRaw) !== '' ? Number(parentRaw) : null;
  const code = String(formData.get('code') ?? '').trim() || null;

  const user = await authorize(data.id ? 'category.edit' : 'category.store');

  try {
    // `level` mirrors the PHP: 0 for a root category, 1 for a sub-category.
    const values = {
      name: data.name,
      code,
      description: data.description,
      status: data.status,
      parentId,
      level: parentId ? 1 : 0,
    };

    if (data.id) {
      await categoryRepository.update(data.id, values, user.id);
      revalidatePath(ROUTES['category.index']);
      return { success: 'Category Updated Successfully' };
    }
    await categoryRepository.create(values, user.id);
    revalidatePath(ROUTES['category.index']);
    return { success: 'Category Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('category.delete');
  if ((await categoryInUse(id)) > 0) {
    await errorLog(`Category ${id} could not be deleted - still used by products`, user.id);
    return;
  }
  await categoryRepository.remove(id);
  revalidatePath(ROUTES['category.index']);
}

// --- Variant ---------------------------------------------------------------

export async function saveVariant(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const data = readCommon(formData);
  const fieldErrors = validateName(data.name);
  if (fieldErrors) return { fieldErrors };

  // The variant form posts its values as a comma-separated list.
  const values = String(formData.get('values') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const user = await authorize(data.id ? 'variant.edit' : 'variant.store');

  try {
    const payload = {
      name: data.name,
      description: data.description,
      status: data.status,
    };

    if (data.id) {
      await updateVariantWithValues(data.id, payload, values, user.id);
      revalidatePath(ROUTES['variant.index']);
      return { success: 'Variant Updated Successfully' };
    }
    await createVariantWithValues(payload, values, user.id);
    revalidatePath(ROUTES['variant.index']);
    return { success: 'Variant Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteVariant(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('variant.delete');
  if ((await variantInUse(id)) > 0) {
    await errorLog(`Variant ${id} could not be deleted - values are in use`, user.id);
    return;
  }
  await variantRepository.remove(id);
  revalidatePath(ROUTES['variant.index']);
}
