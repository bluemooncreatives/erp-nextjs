// `add_product.selling_price_history` - ProductController@selling_price_history,
// `product::product.selling_price_history`.
//
// One row per purchase that changed this SKU's selling price, newest first.
//
// The Blade wrapped a Part Number column in `app('general_setting')->origin == 1`.
// `general_settings` has no `origin` column, so that read is always null and the
// column never rendered; it is left out here rather than reproduced as dead markup.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize, can } from '@/lib/auth/permissions';
import { skuSellingPriceHistory, findSkuWithProduct } from '@/lib/product/products';
import { generalSetting, numberFormat } from '@/lib/settings';
import { route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'Selling Price History' };

export default async function SellingPriceHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('add_product.selling_price_history');
  const { id } = await params;
  const skuId = Number(id);

  const sku = await findSkuWithProduct(skuId);
  if (!sku) notFound();

  const [rows, setting, canShowPurchase] = await Promise.all([
    skuSellingPriceHistory(skuId),
    generalSetting(),
    can('purchase_order.show'),
  ]);

  const symbol = setting.currencySymbol ?? '$';
  const price = (value: number | null | undefined) =>
    `${symbol} ${numberFormat(Number(value ?? 0))}`;

  const columns = [
    { label: 'Sl' },
    { label: 'Name' },
    { label: 'Brand' },
    { label: 'Model' },
    { label: 'Purchase Invoice' },
    { label: 'Old Sell Price' },
    { label: 'Updated Sell Price' },
  ];

  return (
    <>
      <PageHeader
        title="Selling Price History"
        breadcrumb={[{ label: 'Product' }, { label: 'Selling Price History' }]}
      />
      <Card title={`${sku.productName ?? sku.sku ?? skuId} (${rows.length})`} bodyClassName="">
        <DataTable
          columns={columns}
          isEmpty={rows.length === 0}
          empty="This item's selling price has not changed."
        >
          {rows.map((item, index) => (
            <Tr key={item.id}>
              <Td>{index + 1}</Td>
              <Td>{item.productName ?? '-'}</Td>
              <Td>{item.brandName ?? '-'}</Td>
              <Td>{item.modelName ?? '-'}</Td>
              <Td>
                {item.purchaseOrderId && item.purchaseInvoiceNo ? (
                  canShowPurchase ? (
                    <Link
                      href={route('purchase_order.show', { id: item.purchaseOrderId })}
                      className="font-medium text-primary hover:text-primary"
                      target="_blank"
                    >
                      {item.purchaseInvoiceNo}
                    </Link>
                  ) : (
                    item.purchaseInvoiceNo
                  )
                ) : (
                  '-'
                )}
              </Td>
              <Td>{price(item.oldPrice)}</Td>
              <Td>{price(item.newSellingPrice)}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
