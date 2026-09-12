// Quotation detail - port of QuotationController@show.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize, can } from '@/lib/auth/permissions';
import { QuotationConvertStatus, findQuotation } from '@/lib/quotation/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, DetailList } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { convertQuotation } from '../../actions';

export const metadata: Metadata = { title: 'Quotation' };

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('quotation.show');
  const { id } = await params;

  const found = await findQuotation(Number(id));
  if (!found) notFound();

  const { quotation, items, customer } = found;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const money = (v: number | string) => `${symbol} ${numberFormat(v)}`;

  const canConvert = await can('sale.store');
  const dateLabel = await dateConvert(quotation.date);
  const validLabel = quotation.validTillDate
    ? await dateConvert(quotation.validTillDate)
    : '-';

  return (
    <>
      <PageHeader
        title={`Quotation ${quotation.invoiceNo ?? quotation.id}`}
        breadcrumb={[
          { label: 'Quotation', href: ROUTES['quotation.index'] },
          { label: quotation.invoiceNo ?? String(quotation.id) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={route('quotation.order.print_view', { id: quotation.id })}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted"
            >
              Print
            </Link>
            <Link
              href={route('quotation.order.pdf', { id: quotation.id })}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted"
            >
              Export
            </Link>
            {canConvert &&
            quotation.convertStatus !== QuotationConvertStatus.Converted ? (
              <form action={convertQuotation}>
                <input type="hidden" name="id" value={quotation.id} />
                <ActionButton
                  variant="primary"
                  className="px-4 py-2.5 text-sm"
                  confirm="Convert this quotation into a sale?"
                >
                  Convert to sale
                </ActionButton>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-8 space-y-6">
          <Card title="Quotation Details">
            <DetailList
              items={[
                { label: 'Quotation No', value: quotation.invoiceNo ?? '-' },
                { label: 'Reference No', value: quotation.refNo ?? '-' },
                { label: 'Date', value: dateLabel },
                { label: 'Valid until', value: validLabel },
                { label: 'Customer', value: customer?.name ?? '-' },
                { label: 'Shipping address', value: quotation.shippingAddress ?? '-' },
                {
                  label: 'Status',
                  value:
                    quotation.convertStatus === QuotationConvertStatus.Converted ? (
                      <Badge size="sm" color="success">
                        Converted
                      </Badge>
                    ) : (
                      <Badge size="sm" color="warning">
                        Open
                      </Badge>
                    ),
                },
              ]}
            />
            {quotation.notes ? (
              <p className="mt-5 whitespace-pre-line text-sm text-muted-foreground">
                {quotation.notes}
              </p>
            ) : null}
          </Card>

          <Card title="Items" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Product' },
                { label: 'Price' },
                { label: 'Qty' },
                { label: 'Tax %' },
                { label: 'Disc %' },
                { label: 'Subtotal' },
              ]}
              isEmpty={items.length === 0}
            >
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-foreground">
                    {item.name ?? item.sku ?? item.productSkuId}
                  </Td>
                  <Td>{money(item.price)}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>{numberFormat(item.tax)}</Td>
                  <Td>{numberFormat(item.discount)}</Td>
                  <Td>{money(item.subTotal)}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Card title="Summary">
            <dl className="space-y-3 text-sm">
              <Row label="Items total" value={money(quotation.amount)} />
              <Row label="Discount" value={`- ${money(quotation.totalDiscount)}`} />
              <Row label="Tax" value={money(quotation.totalVat)} />
              <Row label="Shipping" value={money(quotation.shippingCharge)} />
              <Row label="Other charges" value={money(quotation.otherCharge)} />
              <div className="border-t border-border pt-3">
                <Row label="Payable" value={money(quotation.payableAmount)} strong />
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold text-foreground '
            : 'text-foreground '
        }
      >
        {value}
      </dd>
    </div>
  );
}
