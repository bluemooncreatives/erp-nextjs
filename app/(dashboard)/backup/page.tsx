// Database backup - port of Modules/Backup BackupController@index
// (`backup::backup.index`).

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listBackups } from '@/lib/backup';
import { config } from '@/lib/config';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { removeBackup } from './actions';
import { ImportBackupForm, GenerateBackupForm } from './forms';

export const metadata: Metadata = { title: 'Database Backup' };

export default async function BackupPage() {
  await authorize('backup.index');

  const backups = await listBackups();
  const [canCreate, canDelete, canImport] = await Promise.all([
    can('backup.create'),
    can('backup.delete'),
    can('backup.import'),
  ]);

  return (
    <>
      <PageHeader
        title="Database Backup"
        breadcrumb={[{ label: 'Settings' }, { label: 'Database Backup' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {canImport ? (
          <Card title="Upload SQL File">
            <ImportBackupForm />
          </Card>
        ) : (
          <div />
        )}

        <Card
          title={`Database Backup List (${backups.length})`}
          bodyClassName=""
          actions={canCreate ? <GenerateBackupForm /> : null}
        >
          <DataTable
            columns={[
              { label: 'Sl' },
              { label: 'Date' },
              { label: 'File Name' },
              { label: 'Download' },
              { label: 'Action' },
            ]}
            isEmpty={backups.length === 0}
            empty="No backups yet."
          >
            {backups.map((backup, index) => (
              <Tr key={backup.folder}>
                <Td>{index + 1}</Td>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {backup.folder}
                </Td>
                <Td>{backup.fileName}</Td>
                <Td>
                  {/* The Blade hid the link in demo mode (`APP_SYNC`). */}
                  {config.app.sync ? (
                    <span
                      className="text-theme-xs text-gray-400"
                      title="Restricted in demo mode"
                    >
                      Download
                    </span>
                  ) : (
                    <a
                      href={backup.downloadUrl}
                      download={backup.fileName}
                      className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                    >
                      Download
                    </a>
                  )}
                </Td>
                <Td>
                  {canDelete ? (
                    <form action={removeBackup}>
                      <input type="hidden" name="dir" value={backup.folder} />
                      <ActionButton confirm="Delete this backup?">Delete</ActionButton>
                    </form>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </>
  );
}
