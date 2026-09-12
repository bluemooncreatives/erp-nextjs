// Edit purchase order - port of PurchaseOrderController@edit
// (`purchase::purchase.edit`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { cNFs, taxes } from '@/lib/db/schema';
import { supplierOptions } from '@/lib/contact/queries';
import { findPurchaseOrder } from '@/lib/purchase/repository';
import { productsForPurchase } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { PageHeader } from '@/components/erp/page';
import { PurchaseForm } from '../../../purchase-form';
import { savePurchaseOrder } from '../../../actions';

export const metadata: Metadata = { title: 'Edit Purchase Order' };

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('purchase_order.edit');
  const { id } = await params;

  const record = await findPurchaseOrder(Number(id));
  if (!record) notFound();

  const { order, items } = record;
  const setting = await generalSetting();

  const [suppliers, locations, taxRows, accounts, skus, agents] = await Promise.all([
    supplierOptions(),
    locationOptions(),
    db.select().from(taxes).where(eq(taxes.status, 1)),
    paymentAccountOptions(),
    productsForPurchase(),
    db.select().from(cNFs),
  ]);

  const isWarehouse = order.purchasableType === MorphType.WareHouse;
  const skuById = new Map(skus.map((s) => [s.id, s]));

  return (
    <>
      <PageHeader
        title="Edit Purchase Order"
        breadcrumb={[{ label: 'Purchase' }, { label: order.invoiceNo || String(order.id) }]}
      />
      <PurchaseForm
        action={savePurchaseOrder}
        submitLabel="Update Purchase Order"
        currencySymbol={setting.currencySymbol ?? '$'}
        options={{
          suppliers: suppliers.map((s) => ({
            value: s.id,
            label: `${s.name}${s.businessName ? ` - ${s.businessName}` : ''}`,
          })),
          locations,
          taxes: taxRows.map((t) => ({ id: t.id, name: t.name, rate: Number(t.rate) })),
          paymentAccounts: accounts.map((a) => ({
            value: a.id,
            label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
          })),
          cnfAgents: agents.map((a) => ({
            value: a.id,
            label: a.name ?? `Agent ${a.id}`,
          })),
          products: skus.map((p) => ({
            id: p.id,
            label: `${p.productName ?? ''} (${p.sku ?? p.id})`,
            purchasePrice: Number(p.purchasePrice),
            sellingPrice: Number(p.sellingPrice),
            tax: Number(p.tax),
          })),
        }}
        defaults={{
          id: order.id,
          supplierId: String(order.supplierId),
          locationRef: `${isWarehouse ? 'warehouse' : 'showroom'}-${order.purchasableId}`,
          date: order.date,
          refNo: order.refNo ?? '',
          lcNo: order.lcNo ?? '',
          cnfId: order.cnfId ? String(order.cnfId) : '',
          shippingAddress: order.shippingAddress ?? '',
          notes: order.notes ?? '',
          discountType: String(order.discountType ?? 2),
          discountValue: Number(order.discountAmount ?? 0),
          taxId: String(order.taxId ?? 0),
          shippingCharge: Number(order.shippingCharge ?? 0),
          otherCharge: Number(order.otherCharge ?? 0),
          lines: items.map((item) => {
            const sku = skuById.get(item.productSkuId);
            return {
              productId: item.productSkuId,
              label: `${item.productName ?? sku?.productName ?? ''} (${item.sku ?? item.productSkuId})`,
              price: Number(item.price),
              sellingPrice: Number(item.sellingPrice ?? sku?.sellingPrice ?? 0),
              quantity: item.quantity,
              tax: Number(item.tax ?? 0),
              discount: Number(item.discount ?? 0),
            };
          }),
        }}
      />
    </>
  );
}
