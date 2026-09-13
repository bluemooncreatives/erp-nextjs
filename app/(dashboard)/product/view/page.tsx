import { LinkButton } from '@/components/common/link-button';
// Product / combo detail - port of ProductController@product_Detail, which
// returned `product::product.product_details` or `product::product.combo_product_details`
// into a modal. The route carries `id` and, for a combo, `type=combo`.

import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findComboProduct, productDetail } from '@/lib/product/products';
import { generalSetting, formatPrice } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { ROUTES, route } from '@/lib/routes';
import { Card, DetailList, PageHeader } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Product Details' };

const NO_IMAGE = 'public/backEnd/img/no_image.png';

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const url = assetUrl(src ?? NO_IMAGE) ?? assetUrl(NO_IMAGE)!;
  return (
    <Image
      src={url}
      alt={alt}
      width={64}
      height={64}
      className="rounded-md object-cover"
      unoptimized
    />
  );
}

export default async function ProductDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string }>;
}) {
  await authorize('add_product.show');
  const sp = await searchParams;
  const id = Number(sp.id);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const price = (value: number | string | null | undefined) =>
    formatPrice(value, symbol);

  if (sp.type === 'combo') {
    const found = await findComboProduct(id);
    if (!found) notFound();
    const { combo, details } = found;

    return (
      <>
        <PageHeader
          title={combo.name ?? 'Combo Product'}
          breadcrumb={[
            { label: 'Products', href: ROUTES['add_product.create'] },
            { label: 'Details' },
          ]}
        />
        <div className="space-y-5">
          <Card title="Details">
            <div className="flex flex-wrap items-start gap-6">
              <Thumb src={combo.imageSource} alt={combo.name ?? ''} />
              <DetailList
                columns={2}
                items={[
                  { label: 'Product Name', value: combo.name },
                  { label: 'Price', value: price(combo.price) },
                  { label: 'Regular Price', value: price(combo.totalRegularPrice) },
                  {
                    label: 'Total Purchase Product',
                    value: price(combo.totalPurchasePrice),
                  },
                ]}
              />
            </div>
          </Card>

          <Card title="Combo Items" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Image' },
                { label: 'Name' },
                { label: 'Category' },
                { label: 'Brand' },
                { label: 'QTY' },
              ]}
              isEmpty={details.length === 0}
              empty="No items in this combo."
            >
              {details.map((d) => (
                <Tr key={d.detail.id}>
                  <Td>
                    <Thumb src={d.imageSource} alt={d.productName ?? ''} />
                  </Td>
                  <Td>{`${d.productName ?? ''} - ${d.sku ?? ''}`}</Td>
                  <Td>{d.categoryName ?? '-'}</Td>
                  <Td>{d.brandName ?? '-'}</Td>
                  <Td>{d.detail.productQty ?? 0}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          {combo.description ? (
            <Card title="Description">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: combo.description }}
              />
            </Card>
          ) : null}
        </div>
      </>
    );
  }

  const found = await productDetail(id);
  if (!found) notFound();

  const { product, skus, variations, stocks } = found;
  const first = skus[0];
  const isService = product.productType === 'Service';
  const unit = found.unitTypeName ?? '';
  const totalStock = stocks.reduce((sum, s) => sum + Number(s.stock ?? 0), 0);

  const stockFor = (skuId: number) =>
    stocks
      .filter((s) => s.productSkuId === skuId)
      .reduce((sum, s) => sum + Number(s.stock ?? 0), 0);

  return (
    <>
      <PageHeader
        title={product.productName ?? 'Product'}
        breadcrumb={[
          { label: 'Products', href: ROUTES['add_product.create'] },
          { label: 'Details' },
        ]}
        actions={
          <LinkButton
            href={route('add_product.edit', { id: product.id })}
            
          >
            <Phrase>Edit</Phrase>
          </LinkButton>
        }
      />

      <div className="space-y-5">
        <Card title="Details">
          <div className="flex flex-wrap items-start gap-6">
            <Thumb src={product.imageSource} alt={product.productName ?? ''} />
            <div className="flex-1">
              <p className="mb-4 text-sm text-muted-foreground">
                In Stock: <span className="font-medium">{totalStock}</span> {unit}
              </p>
              <DetailList
                columns={3}
                items={[
                  { label: 'Product Name', value: product.productName },
                  { label: 'SKU', value: first?.sku ?? '-' },
                  { label: 'Product Type', value: product.productType },
                  { label: 'Category', value: found.categoryName ?? '-' },
                  { label: 'Brand', value: found.brandName ?? '-' },
                  { label: 'Barcode Type', value: first?.barcodeType ?? '-' },
                  {
                    label: 'Product Quantity',
                    value: `${first ? stockFor(first.id) : 0} ${unit}`,
                  },
                  {
                    label: 'Alert Quantity',
                    value: `${first?.alertQuantity ?? 0} ${unit}`,
                  },
                  { label: 'Product Unit', value: unit || '-' },
                  { label: 'Unit Cost', value: price(first?.purchasePrice) },
                  { label: 'Min Selling Price', value: price(first?.minSellingPrice) },
                  {
                    label: isService ? 'Hourly Rate' : 'Selling Price',
                    value: price(first?.sellingPrice),
                  },
                  { label: 'Product Tax', value: first?.tax ?? 0 },
                ]}
              />
            </div>
          </div>
        </Card>

        {!isService ? (
          <Card title="Stock by Branch" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Branch / Warehouse' },
                { label: 'SKU' },
                { label: 'Stock' },
              ]}
              isEmpty={stocks.length === 0}
              empty="No stock recorded."
            >
              {stocks.map((s, i) => (
                <Tr key={`${s.productSkuId}-${s.houseableId}-${i}`}>
                  <Td>{s.showroomName ?? s.warehouseName ?? '-'}</Td>
                  <Td>{skus.find((k) => k.id === s.productSkuId)?.sku ?? '-'}</Td>
                  <Td>{`${Number(s.stock ?? 0)} ${unit}`}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        ) : null}

        {variations.length > 0 ? (
          <Card title={`Variant Items (${variations.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Product Image' },
                { label: 'SKU' },
                { label: 'Selling Price' },
                { label: 'Min Selling Price' },
                { label: 'In Stock' },
              ]}
              isEmpty={false}
            >
              {variations.map((v) => (
                <Tr key={v.variation.id}>
                  <Td>
                    <Thumb src={v.variation.imageSource} alt={v.sku?.sku ?? ''} />
                  </Td>
                  <Td>{v.sku?.sku ?? '-'}</Td>
                  <Td>{price(v.sku?.sellingPrice)}</Td>
                  <Td>{price(v.sku?.minSellingPrice)}</Td>
                  <Td>{`${v.sku ? stockFor(v.sku.id) : 0} ${unit}`}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        ) : null}

        {product.description ? (
          <Card title="Description">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}
