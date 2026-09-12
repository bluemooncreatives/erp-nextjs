// Printer setup - port of PrinterController@index / @getData
// (`setup::printer.index` plus its list partial).

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listPrinters } from '@/lib/setup/printers';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { deletePrinterAction, savePrinter } from './actions';

export const metadata: Metadata = { title: 'Printer' };

export default async function PrinterPage() {
  await authorize('printer.index');

  const rows = await listPrinters();

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('printer.store'),
    can('printer.update'),
    can('printer.delete'),
  ]);

  return (
    <>
      <PageHeader title="Printer" breadcrumb={[{ label: 'Setup' }, { label: 'Printer' }]} />
      <ReferenceCrud
        title="Printers"
        singular="Printer"
        hasDescription={false}
        hasStatus={false}
        extraColumns={['Connection', 'Char/Line', 'IP', 'Port', 'Path']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          extra: [r.connectionType, r.charPerLine, r.ip, r.port, r.path],
        }))}
        total={rows.length}
        page={1}
        perPage={rows.length || 1}
        baseUrl={ROUTES['printer.index']}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={savePrinter}
        deleteAction={deletePrinterAction}
        extraFields={[
          { name: 'connection_type', label: 'Connection Type', required: true },
          { name: 'char_per_line', label: 'Character Per Line', required: true },
          { name: 'ip', label: 'IP Address', required: true },
          { name: 'port', label: 'Port', required: true },
          { name: 'path', label: 'Path', required: true },
        ].map((field, index) => ({
          ...field,
          values: Object.fromEntries(
            rows.map((r) => [
              String(r.id),
              String([r.connectionType, r.charPerLine, r.ip, r.port, r.path][index] ?? ''),
            ]),
          ),
        }))}
      />
    </>
  );
}
