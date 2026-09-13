import { LinkButton } from '@/components/common/link-button';
// Service list - port of ProductController@service (`product::product.list_service`).

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listProductSkus } from '@/lib/product/products';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Wrench, Tags, Coins, ListFilter } from 'lucide-react';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { deleteProductAction } from '../../product-actions';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Service' };

export default async function ServiceListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('add_product.create');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listProductSkus({
    search: sp.search,
    serviceOnly: true,
    page: Number(sp.page ?? 1),
  });

  const [canEdit, canDelete] = await Promise.all([
    can('add_product.edit'),
    can('add_product.delete'),
  ]);

  // Services have no stock, so the useful shape of the catalogue is its price
  // spread and how many categories it spans.
  const rates = rows.map((r) => Number(r.sellingPrice ?? 0));
  const averageRate = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
  const categoryCount = new Set(rows.map((r) => r.categoryName).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Service"
        breadcrumb={[{ label: 'Products' }, { label: 'Service' }]}
        actions={
          <LinkButton
            href={ROUTES['add_product.index']}
            
          >
            Add Service
          </LinkButton>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Services', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Wrench },
          { label: 'Showing now', value: rows.length, detail: 'Services on this page', icon: ListFilter },
          { label: 'Average rate', value: `${symbol} ${numberFormat(averageRate)}`, detail: 'Hourly, on this page', icon: Coins },
          { label: 'Categories', value: categoryCount, detail: 'Represented on this page', icon: Tags },
        ]}
      />

      <Card
        title={`Services (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['add_product.service']}
            defaultValue={sp.search}
            placeholder="Search services..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Service' },
            { label: 'SKU' },
            { label: 'Category' },
            { label: 'Hourly Rate' },
            { label: 'Tax' },
            { label: 'Action' },
          ]}
          isEmpty={rows.length === 0}
          empty="No services found."
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="font-medium text-foreground">
                {row.productName}
              </Td>
              <Td>{row.sku}</Td>
              <Td>{row.categoryName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(row.sellingPrice)}`}</Td>
              <Td>{`${numberFormat(row.tax)}%`}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canEdit && row.productId ? (
                    <LinkButton
                      href={route('add_product.edit', { id: row.productId })}
                      
                    >
                      <Phrase>Edit</Phrase>
                    </LinkButton>
                  ) : null}
                  {canDelete && row.productId ? (
                    <form action={deleteProductAction}>
                      <input type="hidden" name="id" value={row.productId} />
                      <ActionButton confirm={`Delete "${row.productName}"?`}>
                        <Phrase>Delete</Phrase>
                      </ActionButton>
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
          baseUrl={ROUTES['add_product.service']}
          params={sp}
        />
      </Card>
    </>
  );
}
