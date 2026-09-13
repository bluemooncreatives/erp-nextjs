// ---------------------------------------------------------------------------
// Real PDF file generation - replaces dompdf, which has no Node equivalent.
//
// The eight routes below used to serve the same print-styled HTML page the
// on-screen "Print" button opens, relying on the browser's own print dialog
// ("Save as PDF") to produce a file. That is a reasonable substitute for a
// person looking at the screen, but it is not what `sale.pdf` or
// `leave.application.download` meant in the PHP app: a route that hands back
// an actual .pdf file, fit for an API client, an email attachment, or a
// script that fetches one from disk. This module is what makes that true
// here as well, using `pdfmake` - a small, pure-JS layout engine with no
// browser or native dependency - instead of a headless-Chrome round trip.
//
// pdfmake ships no fonts for server use (its bundled vfs is for the browser
// only); the four Roboto weights it does bundle are vendored into
// `lib/pdf/fonts/` so the deployed app does not depend on `node_modules`
// internals surviving a prune. There is no true Bold face in that set -
// Medium stands in, which is what pdfmake's own docs recommend.
// ---------------------------------------------------------------------------

import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pdfMake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

export type { TDocumentDefinitions, Content, Table, TableCell, Style } from 'pdfmake/interfaces';

const FONT_DIR = path.join(process.cwd(), 'lib', 'pdf', 'fonts');
// A path, not a Buffer: pdfmake's own `resolveUrls()` treats every font
// descriptor as a possible remote URL first (`typeof value === 'object'` is
// true for a Buffer too, so it gets handed to the URL resolver and crashes
// reading a property that only a URL descriptor has). A plain path string
// skips that branch outright and is what `provideFont()` reads the file from.
const font = (name: string) => path.join(FONT_DIR, name);

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  pdfMake.setFonts({
    Roboto: {
      normal: font('Roboto-Regular.ttf'),
      bold: font('Roboto-Medium.ttf'),
      italics: font('Roboto-Italic.ttf'),
      bolditalics: font('Roboto-MediumItalic.ttf'),
    },
  });
  // The port never fetches a remote resource or a path outside the vendored
  // fonts above while building a document - refuse both explicitly instead of
  // leaving pdfmake's defaults (a console warning, then allow) in place.
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((candidate: string) => candidate.startsWith(FONT_DIR));
  fontsRegistered = true;
}

const DEFAULTS: Partial<TDocumentDefinitions> = {
  pageMargins: [40, 40, 40, 40],
  defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111827' },
  styles: {
    h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
    h2: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
    muted: { color: '#6b7280', fontSize: 8 },
    tableHeader: { bold: true, fillColor: '#f3f4f6' },
    right: { alignment: 'right' },
    strong: { bold: true },
  },
};

/** Renders one `pdfmake` document definition to a PDF file's bytes. */
export async function renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
  ensureFonts();
  const doc = pdfMake.createPdf({ ...DEFAULTS, ...definition });
  return doc.getBuffer();
}

/** A ready `Response` carrying the rendered PDF, for a `route.ts` handler. */
export async function pdfResponse(
  definition: TDocumentDefinitions,
  filename: string,
): Promise<Response> {
  const buffer = await renderPdf(definition);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename.replace(/["\r\n]/g, '')}"`,
      'Content-Length': String(buffer.byteLength),
    },
  });
}

/**
 * A logo `assetUrl()` points at, as the base64 data URI `pdfmake` embeds
 * inline - or null when there is none, or it is on disk in a format pdfmake
 * cannot place directly (only PNG and JPEG are supported this way).
 */
export function logoImage(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  const ext = path.extname(logoUrl).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : null;
  if (!mime) return null;

  const onDisk = path.join(process.cwd(), 'public', logoUrl.replace(/^\/+/, ''));
  if (!existsSync(onDisk)) return null;
  return `data:${mime};base64,${readFileSync(onDisk).toString('base64')}`;
}

/** The company header block every print sheet opened with. */
export function companyHeader(company: {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
}): Content {
  const logo = logoImage(company.logoUrl);
  return {
    columns: [
      logo ? { image: logo, width: 130 } : { text: company.name ?? ' ', style: 'h1' },
      {
        width: '*',
        alignment: 'right',
        stack: [
          { text: company.name ?? '-', bold: true },
          { text: company.phone ?? '-', style: 'muted' },
          { text: company.email ?? '-', style: 'muted' },
          { text: company.address ?? '-', style: 'muted' },
        ],
      },
    ],
    margin: [0, 0, 0, 18],
  };
}

/** A simple bordered table layout matching the print sheets' plain rules. */
export const RULED_TABLE = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => '#d1d5db',
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
} as const;
