// `print.labels` - ProductController@printLabels (`product::product.labels`).
//
// The product list opened this with a GET carrying the SKU and a set of
// checkboxes, and the Blade repeated one label `$label` times across a page
// laid out for a given sheet size. The same parameters drive it here.
//
// The Blade's barcode image is inside a Blade comment - `{{-- <img ...
// DNS1D::getBarcodePNG(...) --}}` - so the source prints no barcode, and
// neither does this. Adding one would be inventing a feature, not porting it.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findSkuWithProduct, variantNameForSku } from '@/lib/product/products';
import { findProductSku } from '@/lib/product/products';
import { formatPrice, generalSetting } from '@/lib/settings';
import { PrintButton } from '@/components/erp/print-button';
import { LabelOptions } from './label-options';

export const metadata: Metadata = { title: 'Print Label' };

/**
 * `$page` chooses how many labels sit across the sheet. The Blade mapped it to
 * a column count and then to a width class; the two 4s and the duplicated 3 are
 * its own, kept so a saved link lays out the same way.
 */
const COLUMNS: Record<string, number> = {
  '20': 2,
  '30': 4,
  '32': 4,
  '40': 5,
  '50': 7,
  '0': 1,
};

const WIDTH: Record<number, string> = {
  1: 'w-full',
  2: 'w-1/3',
  3: 'w-1/3',
  4: 'w-1/4',
  5: 'w-1/5',
  7: 'w-[14.28%]',
};

export default async function PrintLabelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;

  const skuId = Number(sp.id);
  if (!skuId) {
    return <LabelOptions sku={null} params={sp} />;
  }

  const sku = await findSkuWithProduct(skuId);
  const row = await findProductSku(skuId);
  if (!sku || !row) notFound();

  const setting = await generalSetting();

  // `$request->product_price` gates the price, and `tax == 1` adds the PHP's
  // flat 20% to `price` - not to `selling_price`, which is what it then shows.
  const showPrice = Boolean(sp.product_price);
  const price = showPrice
    ? sp.tax === '1'
      ? Number(row.sellingPrice ?? 0) + (Number(row.purchasePrice ?? 0) * 20) / 100
      : Number(row.sellingPrice ?? 0)
    : 0;

  const count = Math.max(1, Math.min(500, Number(sp.label ?? 1) || 1));
  const columns = COLUMNS[String(sp.page ?? '0')] ?? 1;
  const width = WIDTH[columns] ?? 'w-full';

  const variation = sp.variation ? await variantNameForSku(skuId) : null;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <LabelOptions sku={{ id: skuId, name: sku.productName ?? sku.sku ?? '' }} params={sp} />
        <PrintButton />
      </div>

      <div className="flex flex-wrap">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className={`${width} border-border border p-2 text-center`}
          >
            {sp.business_name ? (
              <b className="block text-[10.625px]">{setting.companyName}</b>
            ) : null}

            {/* The Blade prints the label's own number after the product name.
                It reads like a debug leftover, and it is what the source does. */}
            {sp.name ? (
              <span className="block text-[10.625px]">
                {sku.productName} {index + 1}
              </span>
            ) : null}

            {variation ? <span className="block text-[10px]">{variation}</span> : null}

            {price > 0 ? (
              <span className="block text-[10px]">
                Price : {formatPrice(price, setting.currencySymbol)}
              </span>
            ) : null}

            <span className="block text-[10px]">{row.sku}</span>
          </div>
        ))}
      </div>
    </>
  );
}
