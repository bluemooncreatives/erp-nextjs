// Quotation list - port of QuotationController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { QuotationConvertStatus, listQuotations } from '@/lib/quotation/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { convertQuotation, deleteQuotationAction } from '../actions';

export const metadata: Metadata = { title: 'Quotation' };

export default async function QuotationListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('quotation.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listQuotations({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canCreate, canEdit, canDelete, canConvert] = await Promise.all([
    can('quotation.store'),
    can('quotation.edit'),
    can('quotation.delete'),
    can('sale.store'),
  ]);

  const quotationRows = await Promise.all(
    rows.map(async (q) => ({
      ...q,
      dateLabel: await dateConvert(q.date),
      validLabel: q.validTillDate ? await dateConvert(q.validTillDate) : '-',
    })),
  );

  return (
    <>
      <PageHeader
        title="Quotation"
        breadcrumb={[{ label: 'Quotation' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['quotation.create']}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
            >
              Add Quotation
            </Link>
          ) : null
        }
      />

      <Card
        title={`Quotations (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['quotation.index']}
            defaultValue={sp.search}
            placeholder="Search quotation or customer..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Quotation' },
            { label: 'Date' },
            { label: 'Valid until' },
            { label: 'Customer' },
            { label: 'Amount' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={quotationRows.length === 0}
          empty="No quotations found."
        >
          {quotationRows.map((q) => (
            <Tr key={q.id}>
              <Td>
                <Link
                  href={route('quotation.show', { id: q.id })}
                  className="font-medium text-primary hover:text-primary"
                >
                  {q.invoiceNo ?? q.id}
                </Link>
              </Td>
              <Td>{q.dateLabel}</Td>
              <Td>{q.validLabel}</Td>
              <Td>{q.customerName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(q.payableAmount)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    q.convertStatus === QuotationConvertStatus.Converted
                      ? 'success'
                      : 'warning'
                  }
                >
                  {q.convertStatus === QuotationConvertStatus.Converted
                    ? 'Converted'
                    : 'Open'}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canConvert && q.convertStatus !== QuotationConvertStatus.Converted ? (
                    <form action={convertQuotation}>
                      <input type="hidden" name="id" value={q.id} />
                      <ActionButton
                        variant="primary"
                        confirm="Convert this quotation into a sale?"
                      >
                        To sale
                      </ActionButton>
                    </form>
                  ) : null}
                  {canEdit && q.convertStatus !== QuotationConvertStatus.Converted ? (
                    <Link
                      href={route('quotation.edit', { id: q.id })}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDelete ? (
                    <form action={deleteQuotationAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <ActionButton confirm="Delete this quotation?">Delete</ActionButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['quotation.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
