// Supplier bill - port of AccountsController@supplier / @supplierBill
// (`report::bills.supplier`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { supplierBillReport } from '@/lib/reports/queries';
import { supplierOptions } from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Supplier Bill' };

export default async function SupplierBillPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplier_id?: string }>;
}) {
  const user = await authorize('supplier.bill');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, suppliers] = await Promise.all([
    supplierBillReport({
      from: sp.from,
      to: sp.to,
      supplierId: sp.supplier_id ? Number(sp.supplier_id) : undefined,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    supplierOptions(),
  ]);

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      dateLabel: await dateConvert(row.order.date),
      amountLabel: await singlePrice(row.order.payableAmount),
      paidLabel: await singlePrice(row.paid),
      dueLabel: await singlePrice(Number(row.order.payableAmount) - Number(row.paid)),
    })),
  );

  const [totalLabel, dueTotalLabel] = await Promise.all([
    singlePrice(rows.reduce((sum, r) => sum + Number(r.order.payableAmount), 0)),
    singlePrice(
      rows.reduce(
        (sum, r) => sum + Number(r.order.payableAmount) - Number(r.paid),
        0,
      ),
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Supplier Bill"
        breadcrumb={[{ label: 'Reports' }, { label: 'Supplier Bill' }]}
        actions={
          <ReportFilter
            action={ROUTES['supplier.bill']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'supplier_id',
                placeholder: 'All suppliers',
                value: sp.supplier_id,
                options: suppliers.map((s) => ({ value: s.id, label: s.name })),
              },
            ]}
          />
        }
      />

      <Card
        title={`Bills (${rows.length}) - ${totalLabel}`}
        desc={`Outstanding ${dueTotalLabel}`}
        bodyClassName=""
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Supplier' },
            { label: 'Amount' },
            { label: 'Paid' },
            { label: 'Due' },
            { label: 'Status' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No bills match this filter."
        >
          {decorated.map((row) => (
            <Tr key={row.order.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                <Link
                  href={route('purchase_order.show', { id: row.order.id })}
                  className="text-brand-500 hover:text-brand-600"
                >
                  {row.order.invoiceNo || row.order.id}
                </Link>
              </Td>
              <Td>{row.supplierName ?? '-'}</Td>
              <Td>{row.amountLabel}</Td>
              <Td>{row.paidLabel}</Td>
              <Td>{row.dueLabel}</Td>
              <Td>
                <Badge color={row.order.isPaid === 2 ? 'success' : 'warning'} size="sm">
                  {row.order.isPaid === 2 ? 'Paid' : 'Due'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
