// Customer bill - port of AccountsController@customer / @customerBill
// (`report::bills.customer`), which listed a customer's invoices with what is
// still outstanding on each.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { customerBillReport } from '@/lib/reports/queries';
import { customerOptions } from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { FileText, Wallet, CircleAlert, HandCoins } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Customer Bill' };

export default async function CustomerBillPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer_id?: string }>;
}) {
  const user = await authorize('customer.bill');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, customers] = await Promise.all([
    customerBillReport({
      from: sp.from,
      to: sp.to,
      customerId: sp.customer_id ? Number(sp.customer_id) : undefined,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    customerOptions(false),
  ]);

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      dateLabel: await dateConvert(row.sale.date),
      amountLabel: await singlePrice(row.sale.payableAmount),
      paidLabel: await singlePrice(row.paid),
      dueLabel: await singlePrice(
        Number(row.sale.payableAmount) - Number(row.paid),
      ),
    })),
  );

  const [totalLabel, dueTotalLabel, paidTotalLabel] = await Promise.all([
    singlePrice(rows.reduce((sum, r) => sum + Number(r.sale.payableAmount), 0)),
    singlePrice(
      rows.reduce(
        (sum, r) => sum + Number(r.sale.payableAmount) - Number(r.paid),
        0,
      ),
    ),
    singlePrice(rows.reduce((sum, r) => sum + Number(r.paid), 0)),
  ]);

  return (
    <>
      <PageHeader
        title="Customer Bill"
        breadcrumb={[{ label: 'Reports' }, { label: 'Customer Bill' }]}
        actions={
          <ReportFilter
            action={ROUTES['customer.bill']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'customer_id',
                placeholder: 'All customers',
                value: sp.customer_id,
                options: customers.map((c) => ({ value: c.id, label: c.name })),
              },
            ]}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Outstanding', value: dueTotalLabel, detail: 'Still to be settled', icon: CircleAlert },
          { label: 'Billed total', value: totalLabel, detail: 'Over the selected range', icon: Wallet },
          { label: 'Received', value: paidTotalLabel, detail: 'Settled so far', icon: HandCoins },
          { label: 'Invoices', value: rows.length.toLocaleString('en-US'), detail: 'Matching the filters', icon: FileText },
        ]}
      />

      <Card
        title={`Invoices (${rows.length})`}
        bodyClassName=""
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Customer' },
            { label: 'Amount' },
            { label: 'Paid' },
            { label: 'Due' },
            { label: 'Status' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No invoices match this filter."
        >
          {decorated.map((row) => (
            <Tr key={row.sale.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                <Link
                  href={route('sale.show', { id: row.sale.id })}
                  className="text-primary hover:text-primary"
                >
                  {row.sale.invoiceNo ?? row.sale.id}
                </Link>
              </Td>
              <Td>{row.customerName ?? 'Walk-in'}</Td>
              <Td>{row.amountLabel}</Td>
              <Td>{row.paidLabel}</Td>
              <Td>{row.dueLabel}</Td>
              <Td>
                <Badge color={row.sale.status === 1 ? 'success' : 'warning'} size="sm">
                  {row.sale.status === 1 ? 'Paid':'Unpaid'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
