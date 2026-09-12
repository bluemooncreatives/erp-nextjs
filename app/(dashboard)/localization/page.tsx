// Language list - port of Modules/Localization LanguageController@index
// (`localization::languages.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listLanguages, findLanguage } from '@/lib/setting/repository';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr, SearchBar } from '@/components/erp/table';
import { ToggleSwitch } from '@/components/erp/toggle';
import { ActionButton } from '@/components/erp/submit-button';
import { toggleLanguageStatus, toggleLanguageRtl, deleteLanguage } from './actions';
import { LanguageForm } from './forms';

export const metadata: Metadata = { title: 'Language List' };

export default async function LocalizationPage({
  searchParams,
}: {
  searchParams: Promise<{ search_keyword?: string; edit?: string }>;
}) {
  await authorize('languages.index');
  const sp = await searchParams;

  const rows = await listLanguages(sp.search_keyword);
  const editing = sp.edit ? await findLanguage(Number(sp.edit)) : null;

  const [canCreate, canEdit, canDelete, canToggle, canTranslate] = await Promise.all([
    can('languages.store'),
    can('languages.edit'),
    can('languages.destroy'),
    can('languages.update_active_status'),
    can('language.translate_view'),
  ]);

  return (
    <>
      <PageHeader
        title="Language List"
        breadcrumb={[{ label: 'Settings' }, { label: 'Languages' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card
          title={`Languages (${rows.length})`}
          bodyClassName=""
          actions={
            <SearchBar
              action={ROUTES['languages.index']}
              name="search_keyword"
              defaultValue={sp.search_keyword}
            />
          }
        >
          <DataTable
            columns={[
              { label: 'ID' },
              { label: 'Name' },
              { label: 'Code' },
              { label: 'RTL' },
              { label: 'Active' },
              { label: 'Action' },
            ]}
            isEmpty={rows.length === 0}
            empty="No languages found."
          >
            {rows.map((language, index) => (
              <Tr key={language.id}>
                <Td>{index + 1}</Td>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {language.name}
                </Td>
                <Td>{language.code}</Td>
                <Td>
                  <form action={toggleLanguageRtl}>
                    <input type="hidden" name="id" value={language.id} />
                    <ToggleSwitch
                      checked={language.rtl === 1}
                      label={language.rtl === 1 ? 'Rtl' : 'Ltr'}
                    />
                  </form>
                </Td>
                <Td>
                  <form action={toggleLanguageStatus}>
                    <input type="hidden" name="id" value={language.id} />
                    <ToggleSwitch checked={language.status === 1} disabled={!canToggle} />
                  </form>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Link
                        href={`${ROUTES['languages.index']}?edit=${language.id}`}
                        className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                      >
                        Edit
                      </Link>
                    ) : null}
                    {canTranslate ? (
                      <Link
                        href={route('language.translate_view', { id: language.id })}
                        className="text-theme-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      >
                        Translation
                      </Link>
                    ) : null}
                    {/* The Blade only offered Delete beyond the seeded 114 rows. */}
                    {canDelete && language.id > 114 ? (
                      <form action={deleteLanguage}>
                        <input type="hidden" name="id" value={language.id} />
                        <ActionButton confirm="Delete this language?">Delete</ActionButton>
                      </form>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        {canCreate || (editing && canEdit) ? (
          <Card title={editing ? 'Edit Language' : 'Add New Language'}>
            <LanguageForm language={editing} />
            {editing ? (
              <div className="pt-4">
                <Link
                  href={ROUTES['languages.index']}
                  className="text-theme-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Cancel
                </Link>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
