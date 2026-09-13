import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findSale } from '@/lib/sale/queries';
import { generalSetting, numberFormat } from '@/lib/settings';
import { PrintButton } from '@/components/erp/print-button';
import { ROUTES } from '@/lib/routes';

export default async function PosReceipt({ params }: { params: Promise<{ id: string }> }) {
  const user = await authorize('sale.store');
  const { id } = await params;
  const record = await findSale(Number(id));
  if (!record || record.sale.type !== 2 || (!user.isSystemUser && record.sale.createdBy !== user.id)) notFound();
  const { sale, items, payments, customer } = record;
  const settings = await generalSetting();
  const money = (value: number) => `${settings.currencySymbol ?? ''} ${numberFormat(value)}`;
  const change = payments.reduce((sum, p) => sum + Number(p.returnAmount), 0);
  const tendered = payments.reduce((sum, p) => sum + Number(p.amount) + Number(p.advanceAmount), 0);

  return (
    <>
      {/* Screen-only nav bar — hidden on print */}
      <div className="print:hidden mb-4 flex items-center justify-between">
        <Link href={ROUTES['pos.index']} className="underline text-sm font-medium">
          Next checkout
        </Link>
        <PrintButton />
      </div>

      {/* 72mm thermal receipt */}
      <article className="mx-auto w-full max-w-[72mm] text-black text-xs font-mono">
        {/* ── Company header ── */}
        <div className="text-center space-y-0.5 mb-3">
          {settings.logo && (
            <Image
              src={`/${settings.logo}`}
              alt={settings.companyName ?? settings.siteTitle ?? 'Logo'}
              width={120}
              height={40}
              className="mx-auto h-10 w-auto object-contain mb-1"
            />
          )}
          <h1 className="text-sm font-bold leading-tight">
            {settings.companyName ?? settings.siteTitle}
          </h1>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Tel: {settings.phone}</p>}
          {settings.email && <p>{settings.email}</p>}
        </div>

        <div className="border-t border-dashed border-black" />

        {/* ── Receipt meta ── */}
        <div className="my-2 space-y-0.5">
          <div className="flex justify-between">
            <span className="font-semibold">Receipt:</span>
            <span>{sale.invoiceNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Date:</span>
            <span>{sale.date}</span>
          </div>
          {customer?.name && (
            <div className="flex justify-between">
              <span className="font-semibold">Customer:</span>
              <span className="max-w-[32ch] truncate text-right">{customer.name}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-black" />

        {/* ── Line items ── */}
        <table className="my-2 w-full text-left">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-dashed border-gray-300">
                <td className="py-1.5 pr-1">
                  <div className="leading-tight">{item.name}</div>
                  <div className="text-[10px] text-gray-600">@ {money(item.price)}</div>
                </td>
                <td className="py-1.5 text-center align-top">{item.quantity}</td>
                <td className="py-1.5 text-end align-top">{money(item.subTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black" />

        {/* ── Totals ── */}
        <dl className="my-2 space-y-0.5">
          <div className="flex justify-between">
            <dt>Subtotal</dt><dd>{money(sale.amount)}</dd>
          </div>
          {Number(sale.totalDiscount) > 0 && (
            <div className="flex justify-between">
              <dt>Discount</dt><dd>- {money(Number(sale.totalDiscount))}</dd>
            </div>
          )}
          {Number(sale.totalTax) > 0 && (
            <div className="flex justify-between">
              <dt>Tax</dt><dd>{money(Number(sale.totalTax))}</dd>
            </div>
          )}
          {(sale.shippingCharge > 0 || sale.otherCharge > 0) && (
            <div className="flex justify-between">
              <dt>Charges</dt>
              <dd>{money(sale.shippingCharge + sale.otherCharge)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-black pt-1 mt-1 font-bold text-sm">
            <dt>TOTAL</dt><dd>{money(sale.payableAmount)}</dd>
          </div>
          <div className="flex justify-between pt-1">
            <dt>Tendered</dt><dd>{money(tendered)}</dd>
          </div>
          {change > 0 && (
            <div className="flex justify-between font-semibold">
              <dt>Change</dt><dd>{money(change)}</dd>
            </div>
          )}
        </dl>

        {/* ── Payment methods ── */}
        {payments.length > 0 && (
          <>
            <div className="border-t border-dashed border-black" />
            <div className="my-2 space-y-0.5">
              <div className="font-semibold">Paid via:</div>
              <ul className="space-y-0.5">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between capitalize">
                    <span>{p.paymentMethod}</span>
                    <span>{money(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="border-t border-dashed border-black" />

        {/* ── Footer ── */}
        <div className="my-2 text-center space-y-0.5">
          <p className="font-semibold">Thank you for your purchase!</p>
          {settings.copyrightText && (
            <p className="text-[10px] text-gray-600">{settings.copyrightText}</p>
          )}
        </div>
      </article>
    </>
  );
}
