import { desc, eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { products, productSku, stockReports, unitTypes } from '@/lib/db/schema';
import { singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export default async function StockProductInfoPage() {
  await authorize('stock.product.info');
  const rows = await db.select({ id: stockReports.id, quantity: stockReports.stock, name: products.productName, sku: productSku.sku,
    cost: productSku.costOfGoods, price: productSku.sellingPrice, unit: unitTypes.name,
  }).from(stockReports).leftJoin(productSku, eq(productSku.id, stockReports.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId)).leftJoin(unitTypes, eq(unitTypes.id, products.unitTypeId)).orderBy(desc(stockReports.id));
  const totals = rows.reduce((sum, row) => ({ quantity: sum.quantity + Number(row.quantity), cost: sum.cost + Number(row.quantity) * Number(row.cost), price: sum.price + Number(row.quantity) * Number(row.price) }), { quantity: 0, cost: 0, price: 0 });
  const decorated = await Promise.all(rows.map(async (row) => ({ ...row, costLabel: await singlePrice(Number(row.quantity) * Number(row.cost)), priceLabel: await singlePrice(Number(row.quantity) * Number(row.price)) })));
  return <><PageHeader title="Stock Product Information" /><Card title="Stock Valuation" bodyClassName="">
    <DataTable columns={[{ label: 'Product' }, { label: 'SKU' }, { label: 'In Stock' }, { label: 'Purchase Value' }, { label: 'Selling Value' }]} isEmpty={!rows.length}>
      {decorated.map((row) => <Tr key={row.id}><Td>{row.name}</Td><Td>{row.sku}</Td><Td>{row.quantity} {row.unit}</Td><Td>{row.costLabel}</Td><Td>{row.priceLabel}</Td></Tr>)}
      {rows.length ? <Tr><Td>Total</Td><Td /><Td>{totals.quantity}</Td><Td>{await singlePrice(totals.cost)}</Td><Td>{await singlePrice(totals.price)}</Td></Tr> : null}
    </DataTable>
  </Card></>;
}
