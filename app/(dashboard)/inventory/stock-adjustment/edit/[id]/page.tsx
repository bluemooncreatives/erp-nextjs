import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findStockAdjustment } from '@/lib/inventory/transfers';
import { productsWithStock } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { PageHeader, Card } from '@/components/erp/page';
import { AdjustmentForm } from '../../create/adjustment-form';

export const metadata = { title: 'Edit Stock Adjustment' };

export default async function EditAdjustment({ params }: { params: Promise<{ id: string }> }) {
  await authorize('stock_adjustment.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const found = await findStockAdjustment(id);
  if (!found) notFound();
  const { adjustment, items } = found;
  if (adjustment.status === 1) return <Card title="Stock Adjustment">Approved adjustments cannot be edited.</Card>;
  const [locations, stock, setting] = await Promise.all([
    locationOptions(), productsWithStock(adjustment.adjustableId ?? undefined, adjustment.adjustableType ?? undefined), generalSetting(),
  ]);
  return <>
    <PageHeader title="Edit Stock Adjustment" breadcrumb={[{ label: 'Stock Adjustment', href: '/inventory/stock-adjustment/lists' }, { label: String(id) }]} />
    <AdjustmentForm locations={locations} currencySymbol={setting.currencySymbol ?? '$'}
      defaultLocation={`${adjustment.adjustableType === MorphType.WareHouse ? 'warehouse' : 'showroom'}-${adjustment.adjustableId}`}
      products={stock.map((p) => ({ id: p.id, label: `${p.productName ?? ''} (${p.sku ?? p.id})`, price: Number(p.purchasePrice), stock: Number(p.stock) || 0 }))}
      defaults={{ id, refNo: adjustment.refNo ?? '', date: adjustment.date ?? '', recoveryAmount: adjustment.recoveryAmount, reason: adjustment.reason ?? '',
        lines: items.filter((item) => item.productSkuId != null).map((item) => ({ productId: item.productSkuId!, label: `${item.productName ?? ''} (${item.sku ?? item.productSkuId})`, price: item.unitPrice ?? 0, quantity: item.qty })) }} />
  </>;
}
