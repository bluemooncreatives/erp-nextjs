import { desc } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { versionHistories } from '@/lib/db/schema';
import { generalSetting } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Phrase } from '@/context/TranslationContext';

export default async function SystemUpdatePage() {
  await authorize('setting.updatesystem');
  const [setting, history] = await Promise.all([generalSetting(), db.select().from(versionHistories).orderBy(desc(versionHistories.id))]);
  return <div className="space-y-6"><PageHeader title="System Updates" />
    <Card title="Installed Version"><p className="text-sm text-foreground"><Phrase>ERP version</Phrase>: {setting.systemVersion}. <Phrase>Last updated</Phrase>: {setting.lastUpdatedDate ?? <Phrase>Not recorded</Phrase>}.</p>
      <p className="mt-3 text-sm text-muted-foreground"><Phrase>Legacy PHP update packages cannot be installed in this Next.js application. Application updates must be deployed by your administrator. Package upload is unavailable until a compatible update format is provided.</Phrase></p>
    </Card>
    <Card title="Version History" bodyClassName=""><DataTable columns={[{ label: 'Version'}, { label:'Release Date'}, { label:'Notes' }]} isEmpty={!history.length}>
      {history.map((row) => <Tr key={row.id}><Td>{row.version}</Td><Td>{String(row.releaseDate ?? '')}</Td><Td>{row.notes}</Td></Tr>)}
    </DataTable></Card>
  </div>;
}
