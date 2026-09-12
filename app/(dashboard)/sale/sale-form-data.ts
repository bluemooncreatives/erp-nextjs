// ---------------------------------------------------------------------------
// Everything the sale form needs to render, in one place.
//
// `SaleController@create`, `@edit`, `@cloneSale` and `@convertToQuotation`, and
// `QuotationController@convertToSale`, all assemble the same set - customers,
// locations, active taxes, payment accounts, the products stocked at a
// location, and the active combos. The Blade views repeated that list; here the
// five screens share this loader.
// ---------------------------------------------------------------------------

import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { comboProducts, taxes } from '@/lib/db/schema';
import { customerOptions } from '@/lib/contact/queries';
import { productsWithStock } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import type { SaleFormOptions, SellableProduct } from './sale-form';

export type SaleFormData = {
  options: SaleFormOptions;
  currencySymbol: string;
  /** Keyed `p-<id>` / `c-<id>`, for reading a line's remaining stock. */
  stockByKey: Map<string, SellableProduct>;
};

/**
 * @param locationId   The branch or warehouse whose stock the picker lists.
 * @param locationType Which of the two it is; a missing id lists all stock, as
 *                     the PHP did when a document had no location.
 * @param includeWalkIn `witoutWalkInCustomer()` drops it on the quotation form.
 */
export async function loadSaleFormData({
  locationId,
  locationType = MorphType.ShowRoom,
  includeWalkIn = true,
}: {
  locationId?: number | null;
  locationType?: string;
  includeWalkIn?: boolean;
} = {}): Promise<SaleFormData> {
  const [setting, customers, locations, taxRows, accounts, stockProducts, combos] =
    await Promise.all([
      generalSetting(),
      customerOptions(includeWalkIn),
      locationOptions(),
      db.select().from(taxes).where(eq(taxes.status, 1)),
      paymentAccountOptions(),
      locationId ? productsWithStock(locationId, locationType) : productsWithStock(),
      db.select().from(comboProducts).where(eq(comboProducts.status, 1)),
    ]);

  const products: SellableProduct[] = [
    ...stockProducts.map((product) => ({
      id: product.id,
      label: `${product.productName ?? ''} (${product.sku ?? product.id})`,
      sellingPrice: Number(product.sellingPrice),
      minSellingPrice: Number(product.minSellingPrice),
      tax: Number(product.tax),
      stock: Number(product.stock) || 0,
    })),
    ...combos.map((combo) => ({
      id: combo.id,
      label: `${combo.name ?? 'Combo'} (combo)`,
      sellingPrice: Number(combo.price),
      minSellingPrice: Number(combo.minSellingPrice),
      tax: 0,
      stock: 0,
      isCombo: true,
    })),
  ];

  return {
    currencySymbol: setting.currencySymbol ?? '$',
    stockByKey: new Map(
      products.map((product) => [`${product.isCombo ? 'c' : 'p'}-${product.id}`, product]),
    ),
    options: {
      customers: customers.map((customer) => ({
        value: `customer-${customer.id}`,
        label: `${customer.name}${customer.mobile ? ` (${customer.mobile})` : ''}`,
      })),
      locations,
      taxes: taxRows.map((tax) => ({ id: tax.id, name: tax.name, rate: Number(tax.rate) })),
      paymentAccounts: accounts.map((account) => ({
        value: account.id,
        label: `${account.name}${account.code ? ` (${account.code})` : ''}`,
      })),
      products,
    },
  };
}

/** `saleable_type` / `quotationable_type` as the form's `showroom-1` string. */
export function locationRefOf(
  morphType: string | null | undefined,
  id: number | null | undefined,
): string {
  if (!id) return '';
  return `${morphType === MorphType.WareHouse ? 'warehouse' : 'showroom'}-${id}`;
}
