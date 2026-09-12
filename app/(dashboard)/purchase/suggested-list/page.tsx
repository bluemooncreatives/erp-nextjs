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
import { DataTable, SearchBar, Td, Tr } from '@/components/erp/table';
import { SelectControl } from '@/components/erp/select-control';

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

      <Card
        title={`Products below alert level (${rows.length})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['purchase.suggest']}
            placeholder="Filter by supplier"
          >
            <SelectControl
              name="supplier_id"
              defaultValue={sp.supplier_id ?? ''}
              placeholder="All suppliers"
              aria-label="Supplier"
              options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
              className="sm:w-60"
            />
          </SearchBar>
        }
      >
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
                  className="h-4 w-4 rounded border-border text-primary"
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
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
              >
                Convert to Purchase Order
              </button>
            </div>
          ) : null}
        </form>
      </Card>
    </>
  );
}
