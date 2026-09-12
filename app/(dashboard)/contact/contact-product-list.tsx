// The "Products" screen behind a contact's detail page - port of
// contact::contact.customer_product_list / supplier_product_list
// (ContactController@customerSaleProductList / @supplierPurchaseProductList).

import {
  customerSaleProductItems,
  supplierPurchaseProductItems,
} from '@/lib/contact/queries';
import { variantNameForSku } from '@/lib/product/products';
import { generalSetting, numberFormat } from '@/lib/settings';
import { Card, PageHeader } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export async function ContactProductList({
  contactId,
  contactName,
  variant,
}: {
  contactId: number;
  contactName: string;
  variant: 'customer' | 'supplier';
}) {
  const isCustomer = variant === 'customer';
  const rows = isCustomer
    ? await customerSaleProductItems(contactId)
    : await supplierPurchaseProductItems(contactId);

  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const money = (value: number | string | null | undefined) =>
    `${symbol} ${numberFormat(value)}`;

  // `variantName($item)` printed under the product name for variable products.
  const variantNames = await Promise.all(
    rows.map((row) =>
      row.productName ? variantNameForSku(row.item.productSkuId) : Promise.resolve(null),
    ),
  );

  return (
    <>
      <PageHeader
        title={`${contactName} - Products`}
        breadcrumb={[
          { label: 'Contacts' },
          { label: isCustomer ? 'Customer':'Supplier' },
          { label: 'Products' },
        ]}
      />
      <Card title={isCustomer ? 'Sold Products':'Purchased Products'} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Product Name' },
            { label: 'SKU' },
            { label: 'Price' },
            { label: 'Quantity' },
            { label: 'Tax' },
            { label: 'Discount' },
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'SubTotal' },
          ]}
          isEmpty={rows.length === 0}
          empty="No products found."
        >
          {rows.map((row, index) => (
            <Tr key={row.item.id}>
              <Td>
                {row.productName ?? row.comboName ?? '-'}
                {variantNames[index] ? (
                  <span className="block text-xs text-muted-foreground">
                    ({variantNames[index]})
                  </span>
                ) : null}
              </Td>
              <Td>{row.productName ? (row.sku ?? '-') : ''}</Td>
              <Td>{money(row.item.price)}</Td>
              <Td>{row.item.quantity}</Td>
              <Td>{`${row.item.tax}%`}</Td>
              <Td>{`${row.item.discount}%`}</Td>
              <Td>{row.invoiceNo ?? '-'}</Td>
              <Td>{row.date ?? '-'}</Td>
              <Td>{money(row.item.subTotal)}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
