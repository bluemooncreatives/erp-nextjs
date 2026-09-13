// ---------------------------------------------------------------------------
// Printable document - the shared shape of `sale::sale.print_view`,
// `sale::sale.challan_print_view`, `purchase::*.print_view` and
// `quotation::*.print_view`.
//
// Those blades were four copies of one layout: a company header, a party /
// document block, a line table and a totals column, with the company details
// coming from `general_settings`.
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react';
import { Phrase } from '@/context/TranslationContext';

export type PrintCompany = {
  name: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string | null;
};

export type PrintLine = {
  name: string;
  detail?: string | null;
  price?: string;
  quantity: number | string;
  tax?: string;
  discount?: string;
  subTotal?: string;
};

export function PrintHeader({ company }: { company: PrintCompany }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b border-gray-800 pb-5">
      <div>
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company.name} className="h-16 w-auto" />
        ) : (
          <p className="text-lg font-semibold text-gray-900">{company.name}</p>
        )}
      </div>
      <div className="text-end text-sm text-gray-700">
        <p className="font-semibold text-gray-900">{company.name}</p>
        <p>{company.phone}</p>
        <p>{company.email}</p>
        <p>{company.address}</p>
      </div>
    </header>
  );
}

export function PrintMeta({
  title,
  left,
  right,
}: {
  title: string;
  left: Array<{ label: string; value: string }>;
  right: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="py-6">
      <h1 className="mb-4 text-center text-xl font-semibold uppercase text-gray-900">
        {title}
      </h1>
      <div className="grid gap-6 sm:grid-cols-2">
        <MetaList items={left} />
        <MetaList items={right} align="right" />
      </div>
    </section>
  );
}

function MetaList({
  items,
  align = 'left',
}: {
  items: Array<{ label: string; value: string }>;
  align?: 'left' | 'right';
}) {
  return (
    <dl className={`space-y-1 text-sm ${align === 'right' ? 'text-end' : ''}`}>
      {items.map((item) => (
        <div key={item.label} className="flex gap-2" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <dt className="text-gray-500">{item.label}</dt>
          <dd className="text-gray-900">: {item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PrintLines({
  lines,
  showPrice = true,
  currencyHeading,
}: {
  lines: PrintLine[];
  showPrice?: boolean;
  currencyHeading?: string;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-y border-gray-300 text-start text-gray-600">
          <th className="py-2 pe-2">#</th>
          <th className="py-2 pe-2"><Phrase>Product</Phrase></th>
          {showPrice ? <th className="py-2 pe-2">{currencyHeading ?? 'Price'}</th> : null}
          <th className="py-2 pe-2"><Phrase>Qty</Phrase></th>
          {showPrice ? <th className="py-2 pe-2"><Phrase>Tax</Phrase></th> : null}
          {showPrice ? <th className="py-2 pe-2"><Phrase>Discount</Phrase></th> : null}
          {showPrice ? <th className="py-2 text-end"><Phrase>Subtotal</Phrase></th> : null}
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={`${line.name}-${index}`} className="border-b border-gray-200 align-top">
            <td className="py-2 pe-2">{index + 1}</td>
            <td className="py-2 pe-2 text-gray-900">
              {line.name}
              {line.detail ? (
                <span className="block text-xs text-gray-500">{line.detail}</span>
              ) : null}
            </td>
            {showPrice ? <td className="py-2 pe-2">{line.price}</td> : null}
            <td className="py-2 pe-2">{line.quantity}</td>
            {showPrice ? <td className="py-2 pe-2">{line.tax}</td> : null}
            {showPrice ? <td className="py-2 pe-2">{line.discount}</td> : null}
            {showPrice ? <td className="py-2 text-end">{line.subTotal}</td> : null}
          </tr>
        ))}
        {lines.length === 0 ? (
          <tr>
            <td colSpan={showPrice ? 7 : 3} className="py-6 text-center text-gray-500">
              No items.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export function PrintTotals({
  rows,
  note,
}: {
  rows: Array<{ label: string; value: string; strong?: boolean }>;
  note?: ReactNode;
}) {
  return (
    <section className="mt-6 flex flex-wrap items-start justify-between gap-6">
      <div className="max-w-[55%] text-sm text-gray-600">{note}</div>
      <dl className="min-w-[220px] space-y-1 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex justify-between gap-6 ${
              row.strong ? 'border-t border-gray-300 pt-2 font-semibold text-gray-900' : ''
            }`}
          >
            <dt className="text-gray-600">{row.label}</dt>
            <dd className="text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PrintFooter({ terms }: { terms?: string | null }) {
  if (!terms) return null;
  return (
    <footer className="mt-10 border-t border-gray-300 pt-4 text-xs text-gray-600">
      <p className="whitespace-pre-wrap">{terms}</p>
    </footer>
  );
}
