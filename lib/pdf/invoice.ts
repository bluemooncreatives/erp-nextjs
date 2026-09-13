// ---------------------------------------------------------------------------
// Shared layout for every invoice-shaped document - the sale invoice, the
// delivery challan, the purchase order and the quotation all rendered
// `PrintHeader` / `PrintMeta` / `PrintLines` / `PrintTotals` / `PrintFooter`
// from `components/erp/print-invoice.tsx` with the same shape and different
// labels. This is that same shape, as a `pdfmake` document instead of JSX.
// ---------------------------------------------------------------------------

import 'server-only';
import type { Content, TDocumentDefinitions } from './build';
import { RULED_TABLE, companyHeader } from './build';

export type InvoiceCompany = {
  name: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string | null;
};

export type InvoiceLine = {
  name: string;
  quantity: number | string;
  price?: string;
  tax?: string;
  discount?: string;
  subTotal?: string;
};

export type InvoiceTotal = { label: string; value: string; strong?: boolean };

export function invoiceDocument(options: {
  title: string;
  company: InvoiceCompany;
  meta: {
    left: Array<{ label: string; value: string }>;
    right: Array<{ label: string; value: string }>;
  };
  lines: InvoiceLine[];
  /** `PrintLines showPrice={false}` - the challan lists goods without prices. */
  showPrice?: boolean;
  totals?: InvoiceTotal[];
  note?: string | null;
  /** `['Prepared by', 'Received by']` - the challan's two signature lines. */
  signatures?: [string, string];
  terms?: string | null;
}): TDocumentDefinitions {
  const showPrice = options.showPrice ?? true;
  const header = companyHeader(options.company);

  const metaLine = (row: { label: string; value: string }): Content => ({
    text: [{ text: `${row.label}: `, bold: true }, row.value],
    margin: [0, 0, 0, 2],
  });

  const meta: Content = {
    columns: [
      {
        width: '*',
        stack: [
          { text: options.title, style: 'h2', margin: [0, 0, 0, 6] },
          ...options.meta.left.map(metaLine),
        ],
      },
      { width: '*', stack: options.meta.right.map(metaLine) },
    ],
    columnGap: 24,
    margin: [0, 0, 0, 18],
  };

  const widths: Array<string | number> = ['*'];
  const head: Content[] = [{ text: 'Item', style: 'tableHeader' }];
  if (showPrice) {
    widths.push('auto');
    head.push({ text: 'Price', style: 'tableHeader', alignment: 'right' });
  }
  widths.push('auto');
  head.push({ text: 'Qty', style: 'tableHeader', alignment: 'right' });
  if (showPrice) {
    widths.push('auto', 'auto', 'auto');
    head.push(
      { text: 'Tax', style: 'tableHeader', alignment: 'right' },
      { text: 'Discount', style: 'tableHeader', alignment: 'right' },
      { text: 'Subtotal', style: 'tableHeader', alignment: 'right' },
    );
  }

  const body: Content[][] = [head];
  for (const line of options.lines) {
    const row: Content[] = [line.name];
    if (showPrice) row.push({ text: line.price ?? '-', alignment: 'right' });
    row.push({ text: String(line.quantity), alignment: 'right' });
    if (showPrice) {
      row.push(
        { text: line.tax ?? '-', alignment: 'right' },
        { text: line.discount ?? '-', alignment: 'right' },
        { text: line.subTotal ?? '-', alignment: 'right' },
      );
    }
    body.push(row);
  }
  if (options.lines.length === 0) {
    body.push([
      { text: 'No items.', italics: true, color: '#6b7280' },
      ...Array.from({ length: widths.length - 1 }, () => ({ text: '' })),
    ]);
  }

  const table: Content = {
    table: { widths, body },
    layout: RULED_TABLE,
    margin: [0, 0, 0, 14],
  };

  const content: Content[] = [header, meta, table];

  if (options.totals?.length) {
    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 230,
          table: {
            widths: ['*', 'auto'],
            body: options.totals.map((t) => [
              { text: t.label, bold: Boolean(t.strong) },
              { text: t.value, alignment: 'right', bold: Boolean(t.strong) },
            ]),
          },
          layout: 'noBorders',
        },
      ],
      margin: [0, 0, 0, 14],
    });
  }

  if (options.note) {
    content.push({ text: options.note, margin: [0, 0, 0, 14] });
  }

  if (options.signatures) {
    content.push({
      columns: options.signatures.map((label) => ({
        width: '*',
        text: label,
        alignment: 'center' as const,
        margin: [0, 50, 0, 0] as [number, number, number, number],
      })),
    });
  }

  if (options.terms) {
    content.push({ text: 'Terms & Conditions', style: 'h2' });
    content.push({ text: options.terms, style: 'muted' });
  }

  return { content };
}
