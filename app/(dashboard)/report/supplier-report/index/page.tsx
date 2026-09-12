// Supplier report - port of SupplierReportController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { supplierReport } from '@/lib/reports/queries';
import { supplierOptions } from '@/lib/contact/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Supplier Reports' };

export default async function SupplierReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplier_id?: string }>;
}) {
  await authorize('supplier_report.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, totals, due }, suppliers] = await Promise.all([
    supplierReport({
      from: sp.from,
      to: sp.to,
      supplierId: sp.supplier_id ? Number(sp.supplier_id) : undefined,
    }),
    supplierOptions(),
  ]);

  const orderRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.order.date) })),
  );

  return (
    <>
      <PageHeader
        title="Supplier Reports"
        breadcrumb={[{ label: 'Reports' }, { label: 'Supplier Reports' }]}
      />

      <Card
        title={`Orders (${rows.length}) - ${symbol} ${numberFormat(totals.payable)} billed, ${symbol} ${numberFormat(totals.paid)} paid, ${symbol} ${numberFormat(due)} due`}
        bodyClassName=""
        actions={
          <ReportFilter
            action={ROUTES['supplier_report.index']}
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
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Supplier' },
            { label: 'Total' },
            { label: 'Paid' },
            { label: 'Due' },
          ]}
          isEmpty={orderRows.length === 0}
          empty="No orders match this filter."
        >
          {orderRows.map((r) => (
            <Tr key={r.order.id}>
              <Td>
                <Link
                  href={route('purchase_order.show', { id: r.order.id })}
                  className="font-medium text-brand-500 hover:text-brand-600"
                >
                  {r.order.invoiceNo || r.order.id}
                </Link>
              </Td>
              <Td>{r.dateLabel}</Td>
              <Td>{r.supplierName ?? '-'}</Td>
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
