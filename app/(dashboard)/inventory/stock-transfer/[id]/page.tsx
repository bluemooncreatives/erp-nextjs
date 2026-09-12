import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findStockTransfer } from '@/lib/inventory/transfers';
import { variantNameForSku } from '@/lib/product/products';
import { dateConvert, singlePrice } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata = { title: 'Stock Transfer Details' };

export default async function TransferDetails({ params }: { params: Promise<{ id: string }> }) {
  await authorize('stock-transfer.show');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const found = await findStockTransfer(id);
  if (!found) notFound();
  const { transfer, items, fromName, toName } = found;
  let documents: string[] = [];
  try {
    const parsed: unknown = JSON.parse(transfer.documents ?? '[]');
    if (Array.isArray(parsed)) documents = parsed.filter((value): value is string => typeof value === 'string' && /^(?:public\/|\/?uploads\/)/.test(value));
  } catch { /* Legacy records may have no document array. */ }
  const rows = await Promise.all(items.map(async (item) => ({
    ...item, variant: await variantNameForSku(item.productSkuId),
    priceLabel: await singlePrice(item.price), subtotalLabel: await singlePrice(item.subTotal),
  })));
  // The legacy controller provides `transfer`, while its copied sale template
  // reads an undefined `sale`. Use the actual transfer and stored item totals.
  const fields = [
    ['Date', await dateConvert(transfer.date)], ['From', fromName ?? '-'], ['To', toName ?? '-'],
    ['Sent', transfer.sentAt ? await dateConvert(transfer.sentAt) : '-'],
    ['Received', transfer.receivedAt ? await dateConvert(transfer.receivedAt) : '-'],
    ['Status', transfer.status === 1 ? 'Approved' : 'Pending'],
  ];
  return <>
    <PageHeader title={`Stock Transfer #${id}`} breadcrumb={[{ label: 'Stock Transfer', href:'/inventory/stock-transfer' }, { label: String(id) }]} />
    <div className="space-y-6">
      <Card title="Transfer details"><dl className="grid gap-4 text-sm text-foreground sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl></Card>
      <Card title="Products" bodyClassName="">
        <DataTable columns={['Product', 'SKU', 'Unit price','Quantity','Returned quantity','Subtotal'].map((label) => ({ label }))} isEmpty={!rows.length}>
          {rows.map((item) => <Tr key={item.id}><Td>{item.productName ?? '-'}{item.variant && <div className="text-xs">{item.variant}</div>}</Td><Td>{item.sku ?? '-'}</Td><Td>{item.priceLabel}</Td><Td>{item.quantity}</Td><Td>{item.returnQuantity}</Td><Td>{item.subtotalLabel}</Td></Tr>)}
        </DataTable>
        <div className="space-y-2 p-6 text-right text-sm text-foreground"><p>Total products: {items.reduce((sum, item) => sum + item.quantity, 0)}</p><p>Total: {await singlePrice(items.reduce((sum, item) => sum + item.subTotal, 0))}</p></div>
      </Card>
      <Card title="Notes"><p className="whitespace-pre-wrap text-sm text-foreground">{transfer.notes ?? '-'}</p></Card>
      {documents.length > 0 && <Card title="Documents"><ul className="space-y-2">{documents.map((document, index) => <li key={`${document}-${index}`}><a className="text-sm text-primary underline" href={assetUrl(document) ?? '#'} download>Document {index + 1}</a></li>)}</ul></Card>}
    </div>
  </>;
}
