import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findStockTransfer } from '@/lib/inventory/transfers';
import { productsWithStock } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { PageHeader, Card } from '@/components/erp/page';
import { TransferForm } from '../../create/transfer-form';

export const metadata = { title: 'Edit Stock Transfer' };

export default async function EditTransfer({ params }: { params: Promise<{ id: string }> }) {
  await authorize('stock-transfer.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const found = await findStockTransfer(id);
  if (!found) notFound();
  const { transfer, items } = found;
  if (transfer.status === 1 || transfer.receivedAt) return <Card title="Stock Transfer">Approved transfers cannot be edited.</Card>;
  const [locations, stock, setting] = await Promise.all([locationOptions(), productsWithStock(transfer.sendableId, transfer.sendableType), generalSetting()]);
  return <>
    <PageHeader title="Edit Stock Transfer" breadcrumb={[{ label: 'Stock Transfer', href: '/inventory/stock-transfer' }, { label: String(id) }]} />
    <TransferForm locations={locations} currencySymbol={setting.currencySymbol ?? '$'}
      defaultFrom={`${transfer.sendableType === MorphType.WareHouse ? 'warehouse' : 'showroom'}-${transfer.sendableId}`}
      products={stock.map((p) => ({ id: p.id, label: `${p.productName ?? ''} (${p.sku ?? p.id})`, price: Number(p.purchasePrice), stock: Number(p.stock) || 0 }))}
      defaults={{ id, to: `${transfer.receivableType === MorphType.WareHouse ? 'warehouse' : 'showroom'}-${transfer.receivableId}`, date: transfer.date, notes: transfer.notes ?? '',
        lines: items.map((item) => ({ productId: item.productSkuId, label: `${item.productName ?? ''} (${item.sku ?? item.productSkuId})`, price: item.price, quantity: item.quantity })) }} />
  </>;
}
