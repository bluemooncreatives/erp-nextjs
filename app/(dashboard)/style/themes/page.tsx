import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { themeList } from '@/lib/setting/themes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { themeOperation } from './actions';

export default async function ThemesPage() {
  await authorize('themes.index');
  const [rows, create, edit, copy, setDefault, remove] = await Promise.all([themeList(), can('themes.store'), can('themes.edit'), can('themes.copy'), can('themes.default'), can('themes.destroy')]);
  return <><PageHeader title="Themes" actions={create ? <Link className="text-primary" href="/style/themes/create">Create Theme</Link> : null} />
    <Card title="Available Themes" bodyClassName=""><DataTable columns={[{ label: 'Title' }, { label: 'Color Mode' }, { label: 'Default' }, { label: 'Actions' }]} isEmpty={!rows.length}>
      {rows.map((theme) => <Tr key={theme.id}><Td>{theme.title}</Td><Td>{theme.colorMode}</Td><Td>{theme.isDefault ? 'Yes' : 'No'}</Td><Td><div className="flex flex-wrap items-center gap-3">
        {edit ? <Link className="text-primary" href={`/style/themes/${theme.id}/edit`}>Edit</Link> : null}
        {([['copy', copy, 'Clone'], ['default', setDefault && !theme.isDefault,'Set Default'], ['delete', remove && theme.id !== 1,'Delete']] as const).map(([operation, allowed, label]) => allowed ? <form key={operation} action={themeOperation}><input type="hidden" name="id" value={theme.id} /><input type="hidden" name="operation" value={operation} /><ActionButton variant={operation === 'delete' ? 'danger':'primary'} confirm={operation === 'delete' ? 'Delete this theme?' : undefined}>{label}</ActionButton></form> : null)}
      </div></Td></Tr>)}
    </DataTable></Card></>;
}
