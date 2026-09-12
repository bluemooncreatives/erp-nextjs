// `add_product.serial_key` - ProductController@serial_key_index,
// `product::product.serial_key`.
//
// The `{id}` is a product SKU id, not a product id: the Blade titled the page
// with `$product->product->product_name` after `findSku($id)`.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize, can } from '@/lib/auth/permissions';
import { skuSerialKeys, findSkuWithProduct } from '@/lib/product/products';
import { dateConvert } from '@/lib/settings';
import { route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Serial Key' };

export default async function SerialKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('add_product.serial_key');
  const { id } = await params;
  const skuId = Number(id);

  const sku = await findSkuWithProduct(skuId);
  if (!sku) notFound();

  const [items, canShowSale] = await Promise.all([
    skuSerialKeys(skuId),
    can('sale.show'),
  ]);

  const rows = await Promise.all(
    items.map(async (item) => ({
      ...item,
      soldLabel: item.soldAt ? await dateConvert(item.soldAt) : '',
    })),
  );

  const title = `${sku.productName ?? sku.sku ?? skuId} - Serial Key`;

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={[{ label: 'Product' }, { label: 'Serial Key' }]}
      />
      <Card title={`Serial numbers (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Sl' },
            { label: 'Serial Key' },
            { label: 'Is Sold' },
            { label: 'Invoice' },
            { label: 'Sold Date' },
          ]}
          isEmpty={rows.length === 0}
          empty="No serial numbers recorded for this item."
        >
          {rows.map((item, index) => (
            <Tr key={item.id}>
              <Td>{index + 1}</Td>
              <Td>{item.serialNo ?? '-'}</Td>
              <Td>
                <Badge color={item.isSold === 0 ? 'light' : 'success'}>
                  {item.isSold === 0 ? 'Not Yet' : 'Sold'}
                </Badge>
              </Td>
              <Td>
                {item.saleId && item.invoiceNo ? (
                  canShowSale ? (
                    <Link
                      href={route('sale.show', { id: item.saleId })}
                      className="font-medium text-primary hover:text-primary"
                    >
                      {item.invoiceNo}
                    </Link>
                  ) : (
                    item.invoiceNo
                  )
                ) : (
                  '-'
                )}
              </Td>
              <Td>{item.soldLabel || '-'}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
