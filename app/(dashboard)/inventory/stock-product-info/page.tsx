import { desc, eq } from 'drizzle-orm';
import Image from 'next/image';
import { assetUrl } from '@/lib/paths';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { products, productSku, stockReports, unitTypes } from '@/lib/db/schema';
import { singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportSummary } from '@/components/erp/report-summary';
import { Boxes, Package, TrendingUp, Wallet } from 'lucide-react';

export default async function StockProductInfoPage() {
  await authorize('stock.product.info');
  const rows = await db.select({ id: stockReports.id, quantity: stockReports.stock, name: products.productName, sku: productSku.sku,
    cost: productSku.costOfGoods, price: productSku.sellingPrice, unit: unitTypes.name, image: products.imageSource,
  }).from(stockReports).leftJoin(productSku, eq(productSku.id, stockReports.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId)).leftJoin(unitTypes, eq(unitTypes.id, products.unitTypeId)).orderBy(desc(stockReports.id));
  const totals = rows.reduce((sum, row) => ({ quantity: sum.quantity + Number(row.quantity), cost: sum.cost + Number(row.quantity) * Number(row.cost), price: sum.price + Number(row.quantity) * Number(row.price) }), { quantity: 0, cost: 0, price: 0 });
  const decorated = await Promise.all(rows.map(async (row) => ({ ...row, costLabel: await singlePrice(Number(row.quantity) * Number(row.cost)), priceLabel: await singlePrice(Number(row.quantity) * Number(row.price)) })));
  // Held stock is worth `cost`; it is worth `price` once sold. The gap between
  // the two is the margin sitting in the warehouse, which is the figure this
  // screen exists to show and which used to appear only as a footer row.
  const [costLabel, priceLabel, marginLabel] = await Promise.all([
    singlePrice(totals.cost),
    singlePrice(totals.price),
    singlePrice(totals.price - totals.cost),
  ]);

  return <>
    <PageHeader title="Stock Product Information" />

    <ReportSummary
      figures={[
        { label: 'Stocked items', value: rows.length, detail: 'With a stock record', icon: Package },
        { label: 'Units held', value: totals.quantity, detail: 'Across every item', icon: Boxes },
        { label: 'Purchase value', value: costLabel, detail: 'What the stock cost', icon: Wallet },
        { label: 'Potential margin', value: marginLabel, detail: `On ${priceLabel} of selling value`, icon: TrendingUp },
      ]}
    />

    <Card title="Stock Valuation" bodyClassName="">
    <DataTable columns={[{ label: 'Image' }, { label: 'Product' }, { label: 'SKU' }, { label: 'In Stock' }, { label: 'Purchase Value' }, { label: 'Selling Value' }]} isEmpty={!rows.length}>
      {decorated.map((row) => <Tr key={row.id}><Td><Image src={assetUrl(row.image) ?? '/backEnd/img/no_image.png'} alt={row.name ?? 'Product'} width={48} height={48} unoptimized className="object-contain" /></Td><Td>{row.name}</Td><Td>{row.sku}</Td><Td>{row.quantity} {row.unit}</Td><Td>{row.costLabel}</Td><Td>{row.priceLabel}</Td></Tr>)}
      {rows.length ? <Tr><Td colSpan={3}>Total</Td><Td>{totals.quantity}</Td><Td>{await singlePrice(totals.cost)}</Td><Td>{await singlePrice(totals.price)}</Td></Tr> : null}
    </DataTable>
  </Card></>;
}
