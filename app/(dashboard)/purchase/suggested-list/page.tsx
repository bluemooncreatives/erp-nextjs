import { LinkButton } from '@/components/common/link-button';
// Stock alert list - port of PurchaseOrderController@suggestList
// (`purchase::suggest_list`): SKUs at or below their alert quantity.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { stockAlertList } from '@/lib/purchase/repository';
import { supplierOptions } from '@/lib/contact/queries';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { DataToolbar } from '@/components/erp/data-toolbar';
import { ReportSummary } from '@/components/erp/report-summary';
import { SubmitButton } from '@/components/erp/submit-button';
import { PackageX, ShoppingCart, TriangleAlert, Wallet } from 'lucide-react';

export const metadata: Metadata = { title: 'Stock Alert List' };

export default async function StockAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier_id?: string }>;
}) {
  const user = await authorize('purchase.suggest');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const showroomId =
    user.role.type === 'system_user' ? null : (session?.showroomId ?? user.showroomId);

  const [rows, suppliers] = await Promise.all([
    stockAlertList(showroomId, sp.supplier_id ? Number(sp.supplier_id) : undefined),
    supplierOptions(),
  ]);

  // Everything listed is at or below its alert level; out-of-stock is the
  // subset that has already run dry, which is the more urgent number.
  const outOfStock = rows.filter((row) => Number(row.stock ?? 0) <= 0).length;
  const supplierCount = sp.supplier_id ? 1 : suppliers.length;
  // What it would cost to bring every listed SKU back up to its alert level.
  const refillCost = rows.reduce((sum, row) => {
    const shortfall = Math.max(0, Number(row.alertQuantity ?? 0) - Number(row.stock ?? 0));
    return sum + shortfall * Number(row.purchasePrice ?? 0);
  }, 0);

  return (
    <>
      <PageHeader
        title="Stock Alert List"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Stock Alert List' }]}
        actions={
          <LinkButton
            href={ROUTES['purchase_order.create']}
            
          >
            Create Purchase Order
          </LinkButton>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Below alert level', value: rows.length, detail: 'Needing a reorder', icon: TriangleAlert },
          { label: 'Out of stock', value: outOfStock, detail: 'Already at zero', icon: PackageX },
          { label: 'Suppliers', value: supplierCount, detail: sp.supplier_id ? 'Filtered to one' : 'Available to order from', icon: ShoppingCart },
          {
            label: 'Refill cost',
            value: `${symbol} ${numberFormat(refillCost)}`,
            detail: 'To reach every alert level',
            icon: Wallet,
          },
        ]}
      />

      <Card title="Products below alert level" bodyClassName="">
        <DataToolbar
          filters={[
            {
              id: 'supplier_id',
              label: 'Supplier',
              value: sp.supplier_id ?? 'all',
              className: 'sm:w-60',
              options: [
                { label: 'All suppliers', value: 'all' },
                ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
              ],
            },
          ]}
          resultLabel={rows.length + ' products listed'}
        />

        {/* `convertSuggest()` - the picked SKUs open a prefilled purchase order. */}
        <form method="get" action={ROUTES['purchase_order.create']}>
          {sp.supplier_id ? (
            <input type="hidden" name="supplier_id" value={sp.supplier_id} />
          ) : null}

        <DataTable
          columns={[
            { label: '' },
            { label: 'Product' },
            { label: 'SKU' },
            { label: 'In stock' },
            { label: 'Alert at' },
            { label: 'Purchase price' },
          ]}
          isEmpty={rows.length === 0}
          empty="Nothing is below its alert level."
        >
          {rows.map((row) => (
            <Tr key={row.productSkuId}>
              <Td>
                <input
                  type="checkbox"
                  name="sku"
                  value={row.productSkuId}
                  aria-label={`Select ${row.productName}`}
                  className="border-input text-primary accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] border outline-none focus-visible:ring-[3px]"
                />
              </Td>
              <Td className="font-medium text-foreground">
                {row.productName}
              </Td>
              <Td>{row.sku ?? '-'}</Td>
              <Td>{row.stock}</Td>
              <Td>{row.alertQuantity ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(row.purchasePrice)}`}</Td>
            </Tr>
          ))}
        </DataTable>

          {rows.length ? (
            <div className="flex justify-end border-t border-border px-5 py-3">
              <SubmitButton>Convert to Purchase Order</SubmitButton>
            </div>
          ) : null}
        </form>
      </Card>
    </>
  );
}
