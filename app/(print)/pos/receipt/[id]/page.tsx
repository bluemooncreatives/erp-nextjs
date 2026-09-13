import Link from 'next/link';
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
  return <>
    <div className="print:hidden"><Link href={ROUTES['pos.index']} className="underline">Next checkout</Link><PrintButton /></div>
    <article className="mx-auto w-full max-w-[72mm] text-black text-sm">
      <h1 className="text-center text-lg font-bold">{settings.companyName ?? settings.siteTitle}</h1>
      <p className="text-center">POS receipt</p><p className="mt-4">{sale.invoiceNo}</p><p>{sale.date}</p><p>{customer?.name}</p>
      <table className="my-4 w-full"><thead><tr className="border-b"><th className="text-start">Item</th><th>Qty</th><th className="text-end">Amount</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}><td className="py-2">{item.name}<br /><small>{money(item.price)}</small></td><td className="text-center">{item.quantity}</td><td className="text-end">{money(item.subTotal)}</td></tr>)}
      </tbody></table>
      <dl className="space-y-2 border-t pt-3">{[['Items', sale.amount], ['Discount', -sale.totalDiscount], ['Tax', sale.totalTax], ['Charges', sale.shippingCharge + sale.otherCharge], ['Total', sale.payableAmount], ['Tendered', tendered], ['Change', change]].map(([label, amount]) => <div key={String(label)} className="flex justify-between"><dt>{label}</dt><dd>{money(Number(amount))}</dd></div>)}</dl>
      <ul className="mt-4 border-t pt-3">{payments.map((p) => <li key={p.id} className="flex justify-between"><span>{p.paymentMethod}</span><span>{money(Number(p.amount))}</span></li>)}</ul>
    </article>
  </>;
}
