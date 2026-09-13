// Product movement - port of the `product_movement.index` screen: every
// `product_histories` row for a SKU at the current branch.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { productMovement } from '@/lib/inventory/transfers';
import { productsForPurchase } from '@/lib/product/products';
import { dateConvert } from '@/lib/settings';
import { morphName } from '@/lib/db/morph';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { DataToolbar } from '@/components/erp/data-toolbar';
import { ReportSummary } from '@/components/erp/report-summary';
import { ArrowDownToLine, ArrowUpFromLine, Clock, Repeat } from 'lucide-react';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Product Movement' };

export default async function ProductMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ product_sku_id?: string }>;
}) {
  const user = await authorize('product_movement.index');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, skus] = await Promise.all([
    productMovement({
      productSkuId: sp.product_sku_id ? Number(sp.product_sku_id) : undefined,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    productsForPurchase(),
  ]);

  const movementRows = await Promise.all(
    rows.map(async (row) => ({ ...row, dateLabel: await dateConvert(row.date) })),
  );

  // `in_out` carries the signed quantity, so receipts and issues separate
  // cleanly without needing the movement type.
  const movedIn = rows
    .filter((row) => Number(row.inOut ?? 0) > 0)
    .reduce((sum, row) => sum + Number(row.inOut ?? 0), 0);
  const movedOut = rows
    .filter((row) => Number(row.inOut ?? 0) < 0)
    .reduce((sum, row) => sum + Math.abs(Number(row.inOut ?? 0)), 0);
  const pendingCount = rows.filter((row) => row.status !== 1).length;

  return (
    <>
      <PageHeader
        title="Product Movement"
        breadcrumb={[{ label: 'Inventory'}, { label:'Product Movement' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Movements', value: movementRows.length, detail: 'Matching this filter', icon: Repeat },
          { label: 'Units in', value: movedIn, detail: 'Received into stock', icon: ArrowDownToLine },
          { label: 'Units out', value: movedOut, detail: 'Issued from stock', icon: ArrowUpFromLine },
          { label: 'Pending', value: pendingCount, detail: 'Not yet applied to stock', icon: Clock },
        ]}
      />

      <Card title="Movements" bodyClassName="">
        <DataToolbar
          filters={[
            {
              id: 'product_sku_id',
              label: 'Product',
              value: sp.product_sku_id ?? 'all',
              className: 'sm:w-72',
              options: [
                { label: 'All products', value: 'all' },
                ...skus.map((s) => ({
                  value: String(s.id),
                  label: s.productName + ' (' + s.sku + ')',
                })),
              ],
            },
          ]}
          resultLabel={movementRows.length + ' movements'}
        />

        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Product' },
            { label: 'Type' },
            { label: 'Document' },
            { label: 'Quantity' },
            { label: 'Applied' },
          ]}
          isEmpty={movementRows.length === 0}
          empty="No movements found."
        >
          {movementRows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                {row.productName ?? row.sku ?? row.productSkuId}
              </Td>
              <Td>{row.type}</Td>
              <Td>
                {morphName(row.houseableType) ?? '-'} #{row.houseableId}
              </Td>
              <Td>{row.inOut}</Td>
              <Td>
                <Badge size="sm" color={row.status === 1 ? 'success' : 'warning'}>
                  {row.status === 1 ? 'Applied':'Pending'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
