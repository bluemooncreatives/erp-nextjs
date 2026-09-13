'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { transaction } from '@/lib/db/client';
import { partNumbers, contacts, taxes, productSku, comboProducts, comboProductDetails, products, stockReports, sales, chartAccounts } from '@/lib/db/schema';
import { currentStock, parseLocation } from '@/lib/inventory/stock';
import { ProductType } from '@/lib/product/constants';
import { posInput } from '@/lib/sale/pos-input';
import { approveSale, createSale, INSUFFICIENT_STOCK, recordSalePayments } from '@/lib/sale/repository';
import { route } from '@/lib/routes';
import type { SaleFormState } from '../sale/actions';
import { actionFormData } from '@/lib/forms';

export async function checkoutPos(previous: SaleFormState, data: FormData): Promise<SaleFormState> {
  const user = await authorize('sale.store');
  data = actionFormData(previous, data);
  let saleId: number;
  try {
    const { input, payments, taxId } = posInput(data);
    saleId = await transaction(async (tx) => {
      const [customer] = await tx.select().from(contacts).where(eq(contacts.id, Number(input.customerRef.split('-')[1]))).limit(1);
      if (!customer) throw new Error('Customer no longer exists.');
      const location = parseLocation(input.locationRef)!;
      // Serialize checkouts at this location before stock checks and deductions.
      await tx.select({ id: stockReports.id }).from(stockReports).where(and(eq(stockReports.houseableId, location.id), eq(stockReports.houseableType, location.type))).for('update');
      const requiredStock = new Map<number, number>();
      for (const line of input.lines) {
        const table = line.isCombo ? comboProducts : productSku;
        const [product] = await tx.select({ id: table.id, minimum: table.minSellingPrice }).from(table).where(eq(table.id, line.productableId)).limit(1);
        if (!product || line.price < Number(product.minimum)) throw new Error('A product is missing or priced below its minimum selling price.');
        const components = line.isCombo ? await tx.select().from(comboProductDetails).where(eq(comboProductDetails.comboProductId, line.productableId)) : [{ productSkuId: line.productSkuId, productQty: 1 }];
        if (!components.length) throw new Error('This combo has no products.');
        for (const component of components) {
          if (!component.productSkuId || !component.productQty) throw new Error('Invalid combo component.');
          const [sku] = await tx.select({ type: products.productType }).from(productSku).innerJoin(products, eq(products.id, productSku.productId)).where(eq(productSku.id, component.productSkuId)).limit(1);
          if (!sku) throw new Error('A product no longer exists.');
          if (sku.type !== ProductType.Service) requiredStock.set(component.productSkuId, (requiredStock.get(component.productSkuId) ?? 0) + line.quantity * component.productQty);
        }
      }
      for (const [sku, quantity] of requiredStock) if (await currentStock(location, sku, tx) < quantity) throw new Error('Not enough stock for this checkout.');
      for (const line of input.lines.filter((l) => !l.isCombo)) {
        const available = await tx.select().from(partNumbers).where(and(eq(partNumbers.productSkuId, line.productSkuId), eq(partNumbers.isSold, 0))).for('update');
        const selected = line.partNumberIds ?? [];
        if (new Set(selected).size !== selected.length || selected.some((id) => !available.some((serial) => serial.id === id))) throw new Error('A selected serial number is no longer available.');
        if ((available.length || selected.length) && selected.length !== line.quantity) throw new Error('Select one serial number per item.');
      }
      let rate = 0;
      if (taxId) {
        const [tax] = await tx.select().from(taxes).where(and(eq(taxes.id, taxId), eq(taxes.status, 1))).limit(1);
        if (!tax) throw new Error('Invoice tax is no longer available.');
        rate = Number(tax.rate);
      }
      const taxAmount = Math.round((input.itemAmount - input.totalDiscountAmount) * rate) / 100;
      input.totalTax = `${taxAmount}-${taxId}`;
      input.totalAmount = Math.round((input.itemAmount - input.totalDiscountAmount + taxAmount + input.shippingCharge + input.otherCharge) * 100) / 100;
      const paid = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
      if (paid < input.totalAmount) throw new Error('Enter payment covering the full checkout amount.');
      if (paid > input.totalAmount && !payments.some((p) => p.paymentMethod === 'quick cash')) throw new Error('Use Quick Cash for cash tendered with change.');
      if (payments.filter((p) => p.paymentMethod === 'quick cash').length > 1) throw new Error('Use a single Quick Cash payment for change.');
      if (payments.some((p) => ['cash', 'quick cash'].includes(p.paymentMethod))) {
        const [cashAccount] = await tx.select({ id: chartAccounts.id }).from(chartAccounts).where(and(eq(chartAccounts.contactableId, location.id), eq(chartAccounts.contactableType, location.type))).limit(1);
        if (!cashAccount) throw new Error('Configure the location cash account before checkout.');
      }
      for (const payment of payments) if (payment.accountId) {
        const [account] = await tx.select({ id: chartAccounts.id, group: chartAccounts.configurationGroupId }).from(chartAccounts).where(eq(chartAccounts.id, payment.accountId)).limit(1);
        if (!account || ![1, 2].includes(account.group ?? 0)) throw new Error('Select a cash or bank payment account.');
      }
      const id = await createSale(input, user.id, tx);
      if (id === INSUFFICIENT_STOCK) throw new Error('Not enough stock for this checkout.');
      await recordSalePayments(id, payments, user.id, true, tx);
      await approveSale(id, user.id, tx);
      const [saved] = await tx.select({ approved: sales.isApproved }).from(sales).where(eq(sales.id, id));
      if (!saved?.approved) throw new Error('Configure the customer ledger account before checkout.');
      return id;
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Checkout failed.' };
  }
  revalidatePath('/sale');
  revalidatePath('/pos/pos-order-products');
  redirect(route('pos.receipt', { id: saleId }));
}
