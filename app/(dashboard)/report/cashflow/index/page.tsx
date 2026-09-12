// Cash flow - port of CashFlowController@index (`report::cash_flows.index`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { cashFlowRows } from '@/lib/reports/statements';
import { dateConvert, singlePrice } from '@/lib/settings';
import { toDateString } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormAlert } from '@/components/erp/fields';
import { DateRangeFilter } from '../../period-filter';

export const metadata: Metadata = { title: 'Cash Flow' };

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  await authorize('cash_flow_report.index');
  const sp = await searchParams;

  const from = toDateString(sp.dateFrom);
  const to = toDateString(sp.dateTo);

  // The controller refused a half-filled range.
  const warning =
    from && !to
      ? 'You need to set date-to when you select date-from.'
      : to && !from
        ? 'You need to set date-from when you select date-to.'
        : null;

  const ready = Boolean(from && to && !warning);

  const [paymentRows, receiveRows] = ready
    ? await Promise.all([
        cashFlowRows('voucher_payment','Cr', from!, to!),
        cashFlowRows('voucher_recieve','Dr', from!, to!),
      ])
    : [[], []];

  const decorate = async (rows: typeof paymentRows) =>
    Promise.all(
      rows.map(async (row) => ({
        ...row,
        amountLabel: await singlePrice(row.amount),
        dateLabel: await dateConvert(row.date),
      })),
    );

  const [payments, receives] = await Promise.all([
    decorate(paymentRows),
    decorate(receiveRows),
  ]);

  const [paymentTotal, receiveTotal, netLabel] = await Promise.all([
    singlePrice(paymentRows.reduce((sum, r) => sum + r.amount, 0)),
    singlePrice(receiveRows.reduce((sum, r) => sum + r.amount, 0)),
    singlePrice(
      receiveRows.reduce((sum, r) => sum + r.amount, 0) -
        paymentRows.reduce((sum, r) => sum + r.amount, 0),
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Cash Flow"
        breadcrumb={[{ label: 'Reports' }, { label: 'Cash Flow' }]}
        actions={
          <DateRangeFilter
            action={ROUTES['cash_flow_report.index']}
            from={from ?? undefined}
            to={to ?? undefined}
          />
        }
      />

      {warning ? (
        <div className="mb-5">
          <FormAlert variant="warning" message={warning} />
        </div>
      ) : null}

      {!ready ? (
        <Card title="Cash Flow">
          <EmptyState message="Pick a date range to build the statement." />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={`Receipts - ${receiveTotal}`} bodyClassName="">
              <DataTable
                columns={[
                  { label: 'Date' },
                  { label: 'Voucher' },
                  { label: 'Account' },
                  { label: 'Narration' },
                  { label: 'Amount' },
                ]}
                isEmpty={receives.length === 0}
                empty="No receipts in this range."
              >
                {receives.map((row) => (
                  <Tr key={row.id}>
                    <Td>{row.dateLabel}</Td>
                    <Td>{row.txId ?? '-'}</Td>
                    <Td>{row.accountName ?? '-'}</Td>
                    <Td>{row.narration ?? '-'}</Td>
                    <Td className="text-right">{row.amountLabel}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Card>

            <Card title={`Payments - ${paymentTotal}`} bodyClassName="">
              <DataTable
                columns={[
                  { label: 'Date' },
                  { label: 'Voucher' },
                  { label: 'Account' },
                  { label: 'Narration' },
                  { label: 'Amount' },
                ]}
                isEmpty={payments.length === 0}
                empty="No payments in this range."
              >
                {payments.map((row) => (
                  <Tr key={row.id}>
                    <Td>{row.dateLabel}</Td>
                    <Td>{row.txId ?? '-'}</Td>
                    <Td>{row.accountName ?? '-'}</Td>
                    <Td>{row.narration ?? '-'}</Td>
                    <Td className="text-right">{row.amountLabel}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Card>
          </div>

          <Card title="Net Cash Flow">
            <p className="text-2xl font-semibold text-foreground">
              {netLabel}
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
