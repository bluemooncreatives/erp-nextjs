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
import { ReportSummary } from '@/components/erp/report-summary';
import { Archive, CalendarClock, DatabaseBackup } from 'lucide-react';
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

  // Backups are listed newest first, so the first row is the most recent one -
  // the figure an administrator is actually checking when they open this.
  const latest = backups[0];

  return (
    <>
      <PageHeader
        title="Database Backup"
        breadcrumb={[{ label: 'Settings'}, { label:'Database Backup' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Backups', value: backups.length, detail: 'Stored on this server', icon: DatabaseBackup },
          {
            label: 'Most recent',
            value: latest ? latest.folder : 'None',
            detail: latest ? 'Latest snapshot taken' : 'No backup has been taken',
            icon: CalendarClock,
          },
          {
            label: 'Restore points',
            value: backups.length,
            detail: 'Available to import',
            icon: Archive,
          },
        ]}
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
          title="Database Backup List"
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
                <Td className="font-medium text-foreground">
                  {backup.folder}
                </Td>
                <Td>{backup.fileName}</Td>
                <Td>
                  {/* The Blade hid the link in demo mode (`APP_SYNC`). */}
                  {config.app.sync ? (
                    <span
                      className="text-xs text-muted-foreground"
                      title="Restricted in demo mode"
                    >
                      Download
                    </span>
                  ) : (
                    <a
                      href={backup.downloadUrl}
                      download={backup.fileName}
                      className="text-xs font-medium text-primary hover:text-primary"
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
