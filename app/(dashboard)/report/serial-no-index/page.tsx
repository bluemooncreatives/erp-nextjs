// Product serial report - port of the `serial._product_report.index` screen.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { serialNumberReport } from '@/lib/reports/queries';
import { productsForPurchase } from '@/lib/product/products';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { PackageCheck, ShoppingCart, Undo2, Barcode } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { SelectControl } from '@/components/erp/select-control';

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

  const soldCount = rows.filter((r) => r.serial.isSold === 1).length;
  const returnedCount = rows.filter((r) => r.serial.isReturned === 1).length;

  return (
    <>
      <PageHeader
        title="Product Serial Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Product Serial Report' }]}
      />

      <ReportSummary
        figures={[
          { label: 'In stock', value: rows.length - soldCount, detail: 'Not yet sold', icon: PackageCheck },
          { label: 'Sold', value: soldCount, detail: 'Matching the filters', icon: ShoppingCart },
          { label: 'Returned', value: returnedCount, detail: 'Came back after sale', icon: Undo2 },
          { label: 'Serial numbers', value: rows.length.toLocaleString('en-US'), detail: 'Matching the filters', icon: Barcode },
        ]}
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
            <SelectControl
              name="product_sku_id"
              defaultValue={sp.product_sku_id ?? ''}
              placeholder="All products"
              aria-label="Product"
              options={skus.map((s) => ({
                value: String(s.id),
                label: s.productName + ' (' + s.sku + ')',
              }))}
              className="sm:w-72"
            />
            <SelectControl
              name="is_sold"
              defaultValue={sp.is_sold ?? ''}
              placeholder="Any status"
              aria-label="Status"
              options={[
                { value: '0', label: 'In stock' },
                { value: '1', label: 'Sold' },
              ]}
              className="sm:w-40"
            />
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
