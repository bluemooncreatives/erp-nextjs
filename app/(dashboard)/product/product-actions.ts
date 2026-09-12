'use server';

// ---------------------------------------------------------------------------
// Product server actions - port of Modules/Product/Http/Controllers/ProductController.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { getSession } from '@/lib/auth/session';
import { fileFrom, saveImage } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';
import {
  ProductType,
  createComboProduct,
  createProduct,
  deleteComboProduct,
  deleteProduct,
  setComboStatus,
  updateComboProduct,
  updateProduct,
  type ProductInput,
  type ProductTypeValue,
} from '@/lib/product/products';
import { actionFormData } from '@/lib/forms';

export type ProductFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function num(formData: FormData, key: string, fallback = 0): number {
  const raw = formData.get(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

function numList(formData: FormData, key: string): number[] {
  return formData.getAll(key).map((v) => Number(v)).filter(Number.isFinite);
}

function strList(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((v) => String(v));
}

/**
 * `ProductFormRequest` required a name and a type; the variable-product branch
 * additionally required at least one variant combination.
 */
function validate(formData: FormData): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!str(formData, 'product_name')) {
    errors.product_name = 'The product name field is required.';
  }
  if (!str(formData, 'product_type')) {
    errors.product_type = 'The product type field is required.';
  }
  return Object.keys(errors).length ? errors : null;
}

/**
 * Read the repeated variation rows. The Blade form posted parallel arrays
 * (`variation_sku[]`, `purchase_prices[]`, ...) plus a flat `variation_type[]` /
 * `variation_value_id[]` that the PHP chunked by the number of selected
 * variants - reproduced here.
 */
async function readVariations(formData: FormData): Promise<ProductInput['variations']> {
  const selectedVariants = numList(formData, 'selected_variant');
  const perRow = selectedVariants.length;
  if (perRow === 0) return [];

  const types = numList(formData, 'variation_type');
  const valueIds = numList(formData, 'variation_value_id');
  const skus = strList(formData, 'variation_sku');
  const purchasePrices = numList(formData, 'purchase_prices');
  const sellingPrices = numList(formData, 'selling_prices');
  const minSellingPrices = numList(formData, 'min_selling_prices');
  const alertQuantities = numList(formData, 'alert_quantities');
  const skuIds = numList(formData, 'product_sku_ids');
  const oldImages = strList(formData, 'old_image');
  // `variation_file[]` - one optional image per combination, falling back to
  // the stored path the way `$data['old_image'][$key]` did.
  const variationFiles = formData.getAll('variation_file').filter(
    (value): value is File => value instanceof File && value.size > 0,
  );

  const rowCount = Math.floor(types.length / perRow);
  const out: NonNullable<ProductInput['variations']> = [];

  for (let i = 0; i < rowCount; i++) {
    const uploaded = variationFiles[i]
      ? await saveImage(variationFiles[i], 94, 94)
      : null;

    out.push({
      productSkuId: skuIds[i] ?? null,
      sku: skus[i] ?? null,
      variantIds: types.slice(i * perRow, (i + 1) * perRow),
      variantValueIds: valueIds.slice(i * perRow, (i + 1) * perRow),
      purchasePrice: purchasePrices[i] ?? 0,
      sellingPrice: sellingPrices[i] ?? 0,
      minSellingPrice: minSellingPrices[i] ?? 0,
      alertQuantity: alertQuantities[i] ?? 0,
      imageSource: uploaded ?? oldImages[i] ?? null,
    });
  }
  return out;
}

async function readProductInput(formData: FormData): Promise<ProductInput> {
  const image = fileFrom(formData, 'file');

  return {
    productName: String(formData.get('product_name') ?? '').trim(),
    productType: (str(formData, 'product_type') ?? ProductType.Single) as ProductTypeValue,
    modelId: formData.get('model_id') ? num(formData, 'model_id') : null,
    unitTypeId: formData.get('unit_type_id') ? num(formData, 'unit_type_id') : null,
    brandId: formData.get('brand_id') ? num(formData, 'brand_id') : null,
    categoryId: formData.get('category_id') ? num(formData, 'category_id') : null,
    subCategoryId: formData.get('sub_category_id')
      ? num(formData, 'sub_category_id')
      : null,
    origin: str(formData, 'origin'),
    priceOfOtherCurrency: str(formData, 'price_of_other_currency'),
    description: str(formData, 'product_description'),
    imageSource: await saveImage(image, 94, 94),
    barcodeType: str(formData, 'barcode_type'),
    manageStock: formData.get('manage_stock') ? 1 : 0,
    alertQuantity: str(formData, 'alert_quantity'),

    productSkuCode: str(formData, 'product_sku'),
    purchasePrice: num(formData, 'purchase_price'),
    sellingPrice: num(formData, 'selling_price'),
    minSellingPrice: num(formData, 'min_selling_price'),
    hourlyRate: num(formData, 'hourly_rate'),
    tax: num(formData, 'tax'),
    taxType: str(formData, 'tax_type') ?? 'percent',

    variations: await readVariations(formData),
  };
}

// --- Create ---------------------------------------------------------------

export async function storeProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  formData = actionFormData(_prev, formData);
  const fieldErrors = validate(formData);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize('add_product.store');
  const session = await getSession();

  try {
    const type = str(formData, 'product_type');

    if (type === ProductType.Combo) {
      const skuIds = numList(formData, 'selected_product_id');
      const quantities = numList(formData, 'selected_product_qty');

      await createComboProduct(
        {
          name: String(formData.get('product_name') ?? '').trim(),
          showroomId: session?.showroomId ?? 1,
          barcodeType: str(formData, 'barcode_type'),
          price: num(formData, 'combo_selling_price'),
          totalPurchasePrice: num(formData, 'purchase_price'),
          totalRegularPrice: num(formData, 'selling_price'),
          minSellingPrice: num(formData, 'min_selling_price'),
          description: str(formData, 'product_description'),
          imageSource: await saveImage(fileFrom(formData, 'file'), 94, 94),
        },
        skuIds.map((id, i) => ({ productSkuId: id, quantity: quantities[i] ?? 1 })),
        user.id,
      );

      await successLog('Combo product created', user.id);
    } else {
      const input = await readProductInput(formData);
      await createProduct(input, user.id);
      await successLog(`Product created: ${input.productName}`, user.id);
    }
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['add_product.create']);
  redirect(ROUTES['add_product.create']);
}

// --- Update ---------------------------------------------------------------

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  formData = actionFormData(_prev, formData);
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return { error: 'Missing product id.' };

  const fieldErrors = validate(formData);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize('add_product.edit');

  try {
    const type = str(formData, 'product_type');

    if (type === ProductType.Combo) {
      const skuIds = numList(formData, 'selected_product_id');
      const quantities = numList(formData, 'selected_product_qty');

      await updateComboProduct(
        id,
        {
          name: String(formData.get('product_name') ?? '').trim(),
          barcodeType: str(formData, 'barcode_type'),
          price: num(formData, 'combo_selling_price'),
          totalPurchasePrice: num(formData, 'purchase_price'),
          totalRegularPrice: num(formData, 'selling_price'),
          minSellingPrice: num(formData, 'min_selling_price'),
          description: str(formData, 'product_description'),
          imageSource: await saveImage(fileFrom(formData, 'file'), 94, 94),
        },
        skuIds.map((skuId, i) => ({
          productSkuId: skuId,
          quantity: quantities[i] ?? 1,
        })),
        user.id,
      );
    } else {
      const input = await readProductInput(formData);
      await updateProduct(id, input, user.id);
      await successLog(`Product updated: ${input.productName}`, user.id);
    }
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['add_product.create']);
  redirect(ROUTES['add_product.create']);
}

// --- Delete ---------------------------------------------------------------

export async function deleteProductAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('add_product.delete');

  try {
    await deleteProduct(id);
    await successLog(`Product deleted: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['add_product.create']);
}

export async function deleteComboAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('combo_product.destroy');

  try {
    await deleteComboProduct(id);
    await successLog(`Combo product deleted: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['add_product.create']);
}

/** `ProductController@comboStatus` - the active toggle on the combo list. */
export async function comboStatusAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const status = Number(formData.get('status')) === 1 ? 1 : 0;
  const user = await authorize('combo_product.update_active_status');

  try {
    await setComboStatus(id, status);
    await successLog(`Combo product status updated: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['add_product.create']);
}
