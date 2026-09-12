// Purchase report - port of PurchaseReportController@index / search.

import type { Metadata } from 'next';
import { Banknote, Receipt, ShoppingCart, Wallet } from 'lucide-react';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { purchaseReport } from '@/lib/reports/queries';
import { supplierOptions } from '@/lib/contact/queries';
import { activeShowRooms } from '@/lib/setup/repositories';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Purchase Reports' };

export default async function PurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    supplier_id?: string;
    showroom_id?: string;
  }>;
}) {
  const user = await authorize('purchase_report.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, totals }, suppliers, showrooms] = await Promise.all([
    purchaseReport({
      from: sp.from,
      to: sp.to,
      supplierId: sp.supplier_id ? Number(sp.supplier_id) : undefined,
      showroomId: sp.showroom_id
        ? Number(sp.showroom_id)
        : (session?.showroomId ?? user.showroomId),
      allBranches: user.role.type === 'system_user' && !sp.showroom_id,
    }),
    supplierOptions(),
    activeShowRooms(),
  ]);

  const orderRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.order.date) })),
  );

  return (
    <>
      <PageHeader
        title="Purchase Reports"
        breadcrumb={[{ label: 'Reports' }, { label: 'Purchase Reports' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Orders', value: numberFormat(rows.length, 0), detail: 'Matching this filter', icon: ShoppingCart },
          { label: 'Billed', value: `${symbol} ${numberFormat(totals.payable)}`, detail: 'Total payable', icon: Receipt },
          { label: 'Paid', value: `${symbol} ${numberFormat(totals.paid)}`, detail: 'Settled with suppliers', icon: Wallet },
          { label: 'Outstanding', value: `${symbol} ${numberFormat(totals.payable - totals.paid)}`, detail: 'Still owed', icon: Banknote },
        ]}

      />

      <Card
        title="Purchases"
        bodyClassName=""
        actions={
          <ReportFilter
            action={ROUTES['purchase_report.index']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'showroom_id',
                placeholder: 'All branches',
                value: sp.showroom_id,
                options: showrooms.map((s) => ({ value: s.id, label: s.name })),
              },
              {
                name: 'supplier_id',
                placeholder: 'All suppliers',
                value: sp.supplier_id,
                options: suppliers.map((s) => ({ value: s.id, label: s.name })),
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
            { label: 'Branch' },
            { label: 'Qty' },
            { label: 'Total' },
            { label: 'Paid' },
            { label: 'Due' },
          ]}
          isEmpty={orderRows.length === 0}
          empty="No purchases match this filter."
        >
          {orderRows.map((r) => (
            <Tr key={r.order.id}>
              <Td>
                <Link
                  href={route('purchase_order.show', { id: r.order.id })}
                  className="font-medium text-primary hover:text-primary"
                >
                  {r.order.invoiceNo || r.order.id}
                </Link>
              </Td>
              <Td>{r.dateLabel}</Td>
              <Td>{r.supplierName ?? '-'}</Td>
              <Td>{r.showroomName ?? '-'}</Td>
              <Td>{numberFormat(r.order.totalQuantity, 0)}</Td>
              <Td>{`${symbol} ${numberFormat(r.order.payableAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(r.paidAmount ?? 0)}`}</Td>
              <Td>
                {`${symbol} ${numberFormat(
                  Number(r.order.payableAmount) - Number(r.paidAmount ?? 0),
                )}`}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
