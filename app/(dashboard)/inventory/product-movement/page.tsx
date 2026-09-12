// Product movement - port of the `product_movement.index` screen: every
// `product_histories` row for a SKU at the current branch.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { productMovement } from '@/lib/inventory/transfers';
import { productsForPurchase } from '@/lib/product/products';
import { dateConvert } from '@/lib/settings';
import { morphName } from '@/lib/db/morph';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, SearchBar, Td, Tr } from '@/components/erp/table';
import Badge from '@/components/ui/badge/Badge';

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

  return (
    <>
      <PageHeader
        title="Product Movement"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Product Movement' }]}
      />

      <Card
        title={`Movements (${movementRows.length})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['product_movement.index']}
            placeholder="Filter by product"
          >
            <select
              name="product_sku_id"
              defaultValue={sp.product_sku_id ?? ''}
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">All products</option>
              {skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.productName} ({s.sku})
                </option>
              ))}
            </select>
          </SearchBar>
        }
      >
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
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {row.productName ?? row.sku ?? row.productSkuId}
              </Td>
              <Td>{row.type}</Td>
              <Td>
                {morphName(row.houseableType) ?? '-'} #{row.houseableId}
              </Td>
              <Td>{row.inOut}</Td>
              <Td>
                <Badge size="sm" color={row.status === 1 ? 'success' : 'warning'}>
                  {row.status === 1 ? 'Applied' : 'Pending'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
