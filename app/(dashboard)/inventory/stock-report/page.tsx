// Stock list - port of StockTransferController@stockList (`inventory::stock_report`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { stockList } from '@/lib/inventory/transfers';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Boxes, Wallet, TriangleAlert, Layers } from 'lucide-react';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Stock List' };

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('stock.report');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await stockList({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const stockTotal = rows.reduce((sum, r) => sum + r.stock, 0);
  const stockValueTotal = rows.reduce(
    (sum, r) => sum + r.stock * Number(r.purchasePrice),
    0,
  );
  // The figure worth acting on is what has fallen to its reorder point, which
  // the old title-line summary never surfaced at all.
  const belowAlert = rows.filter(
    (r) => r.alertQuantity != null && r.stock <= Number(r.alertQuantity),
  ).length;

  return (
    <>
      <PageHeader
        title="Stock List"
        breadcrumb={[{ label: 'Inventory'}, { label:'Stock List' }]}
      />

      <ReportSummary
        figures={[
          { label: 'At or below alert level', value: belowAlert, detail: 'Rows on this page', icon: TriangleAlert },
          { label: 'Stock value on this page', value: `${symbol} ${numberFormat(stockValueTotal)}`, detail: 'At purchase price', icon: Wallet },
          { label: 'Units on this page', value: numberFormat(stockTotal, 0), detail: `${rows.length} of ${total} rows`, icon: Boxes },
          { label: 'Stock rows', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Layers },
        ]}
      />

      <Card
        title={`Stock (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['stock.report']}
            defaultValue={sp.search}
            placeholder="Search product or SKU..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Product' },
            { label: 'SKU' },
            { label: 'Location' },
            { label: 'In stock' },
            { label: 'Alert at' },
            { label: 'Purchase price' },
            { label: 'Stock value' },
          ]}
          isEmpty={rows.length === 0}
          empty="No stock records found."
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="font-medium text-foreground">
                {row.productName}
              </Td>
              <Td>{row.sku ?? '-'}</Td>
              <Td>{row.locationName ?? '-'}</Td>
              <Td>
                {row.alertQuantity != null && row.stock <= row.alertQuantity ? (
                  <Badge size="sm" color="warning">
                    {row.stock}
                  </Badge>
                ) : (
                  row.stock
                )}
              </Td>
              <Td>{row.alertQuantity ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(row.purchasePrice)}`}</Td>
              <Td>{`${symbol} ${numberFormat(row.stock * Number(row.purchasePrice))}`}</Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['stock.report']}
          params={sp}
        />
      </Card>
    </>
  );
}
