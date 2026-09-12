// Product costing - port of the `purchase_order.cost_of_goods.index` screen,
// showing every weighted-average recalculation recorded on receipt.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { costOfGoodsHistory } from '@/lib/purchase/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'Product Costing' };

export default async function CostOfGoodsPage() {
  const user = await authorize('purchase_order.cost_of_goods.index');
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const showroomId =
    user.role.type === 'system_user' ? null : (session?.showroomId ?? user.showroomId);

  const rows = await costOfGoodsHistory(showroomId);

  const historyRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      dateLabel: await dateConvert(r.history.date),
    })),
  );

  return (
    <>
      <PageHeader
        title="Product Costing"
        breadcrumb={[{ label: 'Inventory'}, { label:'Product Costing' }]}
      />

      <Card
        title={`Cost of goods history (${historyRows.length})`}
        desc="Each row is a weighted-average recalculation made when stock was received."
        bodyClassName=""
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Product' },
            { label: 'Stock before' },
            { label: 'Received' },
            { label: 'Cost before' },
            { label: 'Cost after' },
          ]}
          isEmpty={historyRows.length === 0}
          empty="No costing history yet."
        >
          {historyRows.map((row) => (
            <Tr key={row.history.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                {row.productName ?? row.sku ?? row.history.productSkuId}
              </Td>
              <Td>{row.history.previousRemainingStock}</Td>
              <Td>{row.history.newlyStock}</Td>
              <Td>{`${symbol} ${numberFormat(row.history.previousCostOfGoodsSold)}`}</Td>
              <Td className="font-medium">
                {`${symbol} ${numberFormat(row.history.newCostOfGoodsSold)}`}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
