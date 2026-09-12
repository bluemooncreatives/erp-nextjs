// Product serial report - port of the `serial._product_report.index` screen.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { serialNumberReport } from '@/lib/reports/queries';
import { productsForPurchase } from '@/lib/product/products';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Product Serial Report' };

export default async function SerialReportPage({
  searchParams,
}: {
  searchParams: Promise<{ product_sku_id?: string; is_sold?: string }>;
}) {
  await authorize('serial._product_report.index');
  const sp = await searchParams;

  const [rows, skus] = await Promise.all([
    serialNumberReport({
      productSkuId: sp.product_sku_id ? Number(sp.product_sku_id) : undefined,
      isSold: sp.is_sold != null && sp.is_sold !== '' ? Number(sp.is_sold) : undefined,
    }),
    productsForPurchase(),
  ]);

  const control =
    'h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground   ';

  return (
    <>
      <PageHeader
        title="Product Serial Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Product Serial Report' }]}
      />

      <Card
        title={`Serial numbers (${rows.length})`}
        bodyClassName=""
        actions={
          <form
            action={ROUTES['serial._product_report.index']}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <select
              name="product_sku_id"
              defaultValue={sp.product_sku_id ?? ''}
              className={control}
            >
              <option value="">All products</option>
              {skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.productName} ({s.sku})
                </option>
              ))}
            </select>
            <select name="is_sold" defaultValue={sp.is_sold ?? ''} className={control}>
              <option value="">Any status</option>
              <option value="0">In stock</option>
              <option value="1">Sold</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary"
            >
              Search
            </button>
          </form>
        }
      >
        <DataTable
          columns={[
            { label: 'Serial No' },
            { label: 'Product' },
            { label: 'SKU' },
            { label: 'Status' },
            { label: 'Returned' },
          ]}
          isEmpty={rows.length === 0}
          empty="No serial numbers match this filter."
        >
          {rows.map((r) => (
            <Tr key={r.serial.id}>
              <Td className="font-medium text-foreground">
                {r.serial.seiralNo ?? '-'}
              </Td>
              <Td>{r.productName ?? '-'}</Td>
              <Td>{r.sku ?? '-'}</Td>
              <Td>
                <Badge size="sm" color={r.serial.isSold === 1 ? 'error' : 'success'}>
                  {r.serial.isSold === 1 ? 'Sold' : 'In stock'}
                </Badge>
              </Td>
              <Td>
                {r.serial.isReturned === 1 ? (
                  <Badge size="sm" color="warning">
                    Returned
                  </Badge>
                ) : (
                  '-'
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
