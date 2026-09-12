import { notFound } from 'next/navigation';
import { inArray } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { findStockAdjustment } from '@/lib/inventory/transfers';
import { variantNameForSku } from '@/lib/product/products';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { PrintButton } from '@/components/erp/print-button';

export const metadata = { title: 'Stock Adjustment Details' };

export default async function AdjustmentDetails({ params }: { params: Promise<{ id: string }> }) {
  await authorize('stock_adjustment.show');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const found = await findStockAdjustment(id);
  if (!found) notFound();
  const { adjustment, items, locationName } = found;
  const userIds = [adjustment.createdBy, adjustment.updatedBy].filter((value): value is number => value != null);
  const people = userIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [];
  const name = (userId: number | null) => people.find((person) => person.id === userId)?.name ?? '-';
  const rows = await Promise.all(items.map(async (item) => ({
    ...item, variant: item.productSkuId == null ? null : await variantNameForSku(item.productSkuId),
    priceLabel: await singlePrice(item.unitPrice), subtotalLabel: await singlePrice(item.subtotal),
  })));
  // The Blade labels were shifted, and recovery_amount was read from the last
  // line. Display the corresponding adjustment fields instead.
  const fields = [
    ['Created date', await dateConvert(adjustment.createdAt)], ['Created user', name(adjustment.createdBy)],
    ['Updated user', name(adjustment.updatedBy)], ['Recovery date', await dateConvert(adjustment.date)],
    ['Reference', adjustment.refNo ?? '-'], ['Status', adjustment.status === 1 ? 'Approved' : 'Pending'],
    ['Location', locationName ?? '-'],
  ];
  return <>
    <PageHeader title="Stock Adjustment Details" breadcrumb={[{ label: 'Stock Adjustment', href:'/inventory/stock-adjustment/lists' }, { label: String(id) }]} />
    <PrintButton />
    <style>{`@media print {
      body * { visibility: hidden; }
      #adjustment-print, #adjustment-print * { visibility: visible; }
      #adjustment-print { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; }
    }`}</style>
    <div id="adjustment-print" className="space-y-6">
      <Card title={`Adjustment ${adjustment.refNo ?? id}`}>
        <dl className="grid gap-4 text-sm text-foreground sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl>
      </Card>
      <Card title="Products" bodyClassName="">
        <DataTable columns={['Product', 'SKU', 'Unit price','Quantity','Subtotal'].map((label) => ({ label }))} isEmpty={!rows.length}>
          {rows.map((item) => <Tr key={item.id}><Td>{item.productName ?? '-'}{item.variant && <div className="text-xs">{item.variant}</div>}</Td><Td>{item.sku ?? '-'}</Td><Td>{item.priceLabel}</Td><Td>{item.qty}</Td><Td>{item.subtotalLabel}</Td></Tr>)}
        </DataTable>
        <div className="space-y-2 p-6 text-right text-sm text-foreground">
          <p>Total products: {items.reduce((sum, item) => sum + item.qty, 0)}</p>
          <p>Total: {await singlePrice(items.reduce((sum, item) => sum + item.subtotal, 0))}</p>
          <p>Total recovery: {await singlePrice(adjustment.recoveryAmount)}</p>
        </div>
      </Card>
      <Card title="Reason"><p className="whitespace-pre-wrap text-sm text-foreground">{adjustment.reason ?? '-'}</p></Card>
    </div>
  </>;
}
