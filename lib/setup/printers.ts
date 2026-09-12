// Printers - port of Modules/Setup/Http/Controllers/PrinterController and its
// `Printer` model. `getData()` listed them newest first.

import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { printers, type PrintersRow } from '@/lib/db/schema';

export type PrinterInput = {
  name: string;
  connectionType: string | null;
  charPerLine: string | null;
  ip: string | null;
  port: string | null;
  path: string | null;
};

export async function listPrinters(): Promise<PrintersRow[]> {
  return db.select().from(printers).orderBy(desc(printers.id));
}

export async function findPrinter(id: number): Promise<PrintersRow | null> {
  const [row] = await db.select().from(printers).where(eq(printers.id, id)).limit(1);
  return row ?? null;
}

export async function createPrinter(data: PrinterInput): Promise<void> {
  await db.insert(printers).values({ ...data, createdAt: new Date(), updatedAt: new Date() });
}

export async function updatePrinter(id: number, data: PrinterInput): Promise<void> {
  await db.update(printers).set({ ...data, updatedAt: new Date() }).where(eq(printers.id, id));
}

export async function deletePrinter(id: number): Promise<void> {
  await db.delete(printers).where(eq(printers.id, id));
}
