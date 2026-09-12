// Product-wise purchase report - port of PurchaseReportController@productPurchase.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { productPurchaseReport } from '@/lib/reports/queries';
import { productsForPurchase } from '@/lib/product/products';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Product wise Purchase' };

export default async function ProductPurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; product_sku_id?: string }>;
}) {
  const user = await authorize('product_purchase_report.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, totals }, skus] = await Promise.all([
    productPurchaseReport({
      from: sp.from,
      to: sp.to,
      productSkuId: sp.product_sku_id ? Number(sp.product_sku_id) : undefined,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    productsForPurchase(),
  ]);

  const itemRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.date) })),
  );

  return (
    <>
      <PageHeader
        title="Product wise Purchase"
        breadcrumb={[{ label: 'Reports' }, { label: 'Product wise Purchase' }]}
      />

      <Card
        title={`Lines (${rows.length}) - ${numberFormat(totals.quantity, 0)} units, ${symbol} ${numberFormat(totals.amount)}`}
        bodyClassName=""
        actions={
          <ReportFilter
            action={ROUTES['product_purchase_report.index']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'product_sku_id',
                placeholder: 'All products',
                value: sp.product_sku_id,
                options: skus.map((s) => ({
                  value: s.id,
                  label: `${s.productName ?? ''} (${s.sku ?? s.id})`,
                })),
              },
            ]}
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Supplier' },
            { label: 'Product' },
            { label: 'Price' },
            { label: 'Qty' },
            { label: 'Subtotal' },
          ]}
          isEmpty={itemRows.length === 0}
          empty="No lines match this filter."
        >
          {itemRows.map((r) => (
            <Tr key={r.item.id}>
              <Td>{r.invoiceNo || '-'}</Td>
              <Td>{r.dateLabel}</Td>
              <Td>{r.supplierName ?? '-'}</Td>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {r.productName ?? r.sku ?? r.item.productSkuId}
              </Td>
              <Td>{`${symbol} ${numberFormat(r.item.price)}`}</Td>
              <Td>{r.item.quantity}</Td>
              <Td>{`${symbol} ${numberFormat(r.item.subTotal)}`}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
