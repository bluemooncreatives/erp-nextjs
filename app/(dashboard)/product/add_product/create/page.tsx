import { LinkButton } from '@/components/common/link-button';
// Product list.
//
// Port of ProductController@create (which rendered `product::product.list_products`
// - in this codebase `create()` is the LIST and `index()` is the add form).

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import {
  comboItemCountMap,
  listComboProducts,
  listProductSkus,
  skuStockAt,
} from '@/lib/product/products';
import { productFormOptions } from '@/lib/product/repositories';
import { getSession } from '@/lib/auth/session';
import { generalSetting, numberFormat } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary, type ReportFigure } from '@/components/erp/report-summary';
import { Package, Layers, PackageX, ListFilter } from 'lucide-react';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { DataToolbar } from '@/components/erp/data-toolbar';
import {
  comboStatusAction,
  deleteComboAction,
  deleteProductAction,
} from '../../product-actions';
import { ActionButton } from '@/components/erp/submit-button';
import { Tabs } from '@/components/erp/tabs';
import { ToggleSwitch } from '@/components/erp/toggle';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Product List' };

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    brand_id?: string;
    category_id?: string;
    combo_search?: string;
  }>;
}) {
  await authorize('add_product.create');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listProductSkus({
    search: sp.search,
    brandId: sp.brand_id ? Number(sp.brand_id) : undefined,
    categoryId: sp.category_id ? Number(sp.category_id) : undefined,
    page: Number(sp.page ?? 1),
  });

  const options = await productFormOptions();

  const stock = session?.showroomId
    ? await skuStockAt(
        rows.map((r) => r.id),
        session.showroomId,
      )
    : new Map<number, number>();

  const [canEdit, canDelete, canShow] = await Promise.all([
    can('add_product.edit'),
    can('add_product.delete'),
    can('add_product.show'),
  ]);

  const combos = await listComboProducts(sp.combo_search);
  const comboItemCounts = await comboItemCountMap(combos.map((c) => c.id));
  const [canComboStatus, canComboEdit, canComboDelete] = await Promise.all([
    can('combo_product.update_active_status'),
    can('add_product.editCombo'),
    can('combo_product.destroy'),
  ]);

  // Both tabs sit under one summary, so it counts the catalogue rather than
  // whichever tab happens to be open. Out-of-stock is branch-specific, so it
  // only appears when a branch is actually selected.
  const catalogueFigures: ReportFigure[] = [
    { label: 'Products', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Package },
    { label: 'Showing now', value: rows.length, detail: 'Products on this page', icon: ListFilter },
    { label: 'Combo products', value: combos.length, detail: 'Matching the combo search', icon: Layers },
  ];
  if (session?.showroomId) {
    catalogueFigures.push({
      label: 'Out of stock here',
      value: rows.filter((r) => (stock.get(r.id) ?? 0) <= 0).length,
      detail: 'On this page, this branch',
      icon: PackageX,
    });
  }

  const isFiltered = Boolean(sp.search || sp.brand_id || sp.category_id);

  const productsPanel = (
        <Card title="Products" bodyClassName="">
          {/* Search and both filters in one bar, with a chip per active filter -
              the brand/category selects used to be bare `<select>`s, whose open
              list the browser draws itself and no stylesheet can reach. */}
          <DataToolbar
            search={{ value: sp.search, placeholder: 'Search name or SKU...' }}
            filters={[
              {
                id: 'brand_id',
                label: 'Brand',
                value: sp.brand_id ?? 'all',
                options: [
                  { label: 'All brands', value: 'all' },
                  ...options.brands.map((brand) => ({
                    label: brand.name,
                    value: String(brand.id),
                  })),
                ],
              },
              {
                id: 'category_id',
                label: 'Category',
                value: sp.category_id ?? 'all',
                options: [
                  { label: 'All categories', value: 'all' },
                  ...options.categories.map((category) => ({
                    label: category.name,
                    value: String(category.id),
                  })),
                ],
              },
            ]}
            resultLabel={
              isFiltered
                ? `${rows.length} shown of ${total.toLocaleString('en-US')} matching`
                : `${total.toLocaleString('en-US')} products`
            }
          />

          <DataTable
            columns={[
              { label: 'Product' },
              { label: 'SKU' },
              { label: 'Category' },
              { label: 'Brand' },
              { label: 'Purchase' },
              { label: 'Selling' },
              { label: 'Stock' },
              { label: 'Action' },
            ]}
            isEmpty={rows.length === 0}
            empty="No products found."
          >
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {row.imageSource ? (
                      <Image
                        src={assetUrl(row.imageSource)!}
                        alt={row.productName ?? ''}
                        width={36}
                        height={36}
                        className="rounded-md object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        -
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {row.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.productType}</p>
                    </div>
                  </div>
                </Td>
                <Td>{row.sku}</Td>
                <Td>{row.categoryName ?? '-'}</Td>
                <Td>{row.brandName ?? '-'}</Td>
                <Td>{`${symbol} ${numberFormat(row.purchasePrice)}`}</Td>
                <Td>{`${symbol} ${numberFormat(row.sellingPrice)}`}</Td>
                <Td>{stock.get(row.id) ?? 0}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {canShow && row.productId ? (
                      <Link
                        href={route('add_product.product_Detail', { id: row.productId })}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        <Phrase>View</Phrase>
                      </Link>
                    ) : null}
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
            baseUrl={ROUTES['add_product.create']}
            params={sp}
          />
        </Card>
  );

  const comboPanel = (
    <Card
      title={`Combo Products (${combos.length})`}
      bodyClassName=""
      actions={
        <SearchBar
          action={ROUTES['add_product.create']}
          name="combo_search"
          defaultValue={sp.combo_search}
          placeholder="Search combo name..."
        />
      }
    >
      <DataTable
        columns={[
          { label: 'Combo' },
          { label: 'Price' },
          { label: 'Regular Price' },
          { label: 'Items' },
          { label: 'Status' },
          { label: 'Action' },
        ]}
        isEmpty={combos.length === 0}
        empty="No combo products found."
      >
        {combos.map((combo) => (
          <Tr key={combo.id}>
            <Td>
              <div className="flex items-center gap-3">
                {combo.imageSource ? (
                  <Image
                    src={assetUrl(combo.imageSource)!}
                    alt={combo.name ?? ''}
                    width={36}
                    height={36}
                    className="rounded-md object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    -
                  </span>
                )}
                <p className="font-medium text-foreground">
                  {combo.name}
                </p>
              </div>
            </Td>
            <Td>{`${symbol} ${numberFormat(combo.price)}`}</Td>
            <Td>{`${symbol} ${numberFormat(combo.totalRegularPrice)}`}</Td>
            <Td>{`${comboItemCounts.get(combo.id) ?? 0} pcs`}</Td>
            <Td>
              <form action={comboStatusAction}>
                <input type="hidden" name="id" value={combo.id} />
                <ToggleSwitch checked={combo.status === 1} disabled={!canComboStatus} />
              </form>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                {canShow ? (
                  <Link
                    href={route('add_product.product_Detail', {
                      id: combo.id,
                      type: 'combo',
                    })}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    <Phrase>View</Phrase>
                  </Link>
                ) : null}
                {canComboEdit && (comboItemCounts.get(combo.id) ?? 0) > 0 ? (
                  <LinkButton
                    href={route('add_product.editCombo', { id: combo.id })}
                    
                  >
                    <Phrase>Edit</Phrase>
                  </LinkButton>
                ) : null}
                {canComboDelete ? (
                  <form action={deleteComboAction}>
                    <input type="hidden" name="id" value={combo.id} />
                    <ActionButton confirm={`Delete "${combo.name}"?`}><Phrase>Delete</Phrase></ActionButton>
                  </form>
                ) : null}
              </div>
            </Td>
          </Tr>
        ))}
      </DataTable>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Product List"
        breadcrumb={[{ label: 'Products' }, { label: 'Product List' }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <LinkButton
              href={ROUTES['add_product.csv_upload']}
              
            >
              Upload via CSV
            </LinkButton>
            <LinkButton
              href={ROUTES['add_product.index']}
              
            >
              <Phrase>Add Product</Phrase>
            </LinkButton>
          </div>
        }
      />

      <ReportSummary figures={catalogueFigures} />

      <Tabs
        orientation="horizontal"
        tabs={[
          { id: 'products', label: 'Products', content: productsPanel },
          { id: 'combo', label: 'Combo Product', content: comboPanel },
        ]}
      />
    </>
  );
}
