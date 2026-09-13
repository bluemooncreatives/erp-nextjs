// Language list - port of Modules/Localization LanguageController@index
// (`localization::languages.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listLanguages, findLanguage } from '@/lib/setting/repository';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { DataToolbar } from '@/components/erp/data-toolbar';
import { ReportSummary } from '@/components/erp/report-summary';
import { Check, Languages, MoveLeft } from 'lucide-react';
import { ToggleSwitch } from '@/components/erp/toggle';
import { ActionButton } from '@/components/erp/submit-button';
import { toggleLanguageStatus, toggleLanguageRtl, deleteLanguage } from './actions';
import { LanguageForm } from './forms';
import { Phrase } from '@/context/TranslationContext';

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

  const activeCount = rows.filter((language) => language.status === 1).length;
  const rtlCount = rows.filter((language) => language.rtl === 1).length;

  return (
    <>
      <PageHeader
        title="Language List"
        breadcrumb={[{ label: 'Settings'}, { label:'Languages' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Languages', value: rows.length, detail: 'Matching this search', icon: Languages },
          { label: 'Active', value: activeCount, detail: 'Offered to users', icon: Check },
          { label: 'Right to left', value: rtlCount, detail: 'Rendered RTL', icon: MoveLeft },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card title="All languages" bodyClassName="">
          <DataToolbar
            search={{
              name: 'search_keyword',
              value: sp.search_keyword,
              placeholder: 'Search language or code',
            }}
            resultLabel={rows.length + ' languages'}
          />

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
                <Td className="font-medium text-foreground">
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
                        className="text-xs font-medium text-primary hover:text-primary"
                      >
                        <Phrase>Edit</Phrase>
                      </Link>
                    ) : null}
                    {canTranslate ? (
                      <Link
                        href={route('language.translate_view', { id: language.id })}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Phrase>Translation</Phrase>
                      </Link>
                    ) : null}
                    {/* The Blade only offered Delete beyond the seeded 114 rows. */}
                    {canDelete && language.id > 114 ? (
                      <form action={deleteLanguage}>
                        <input type="hidden" name="id" value={language.id} />
                        <ActionButton confirm="Delete this language?"><Phrase>Delete</Phrase></ActionButton>
                      </form>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        {canCreate || (editing && canEdit) ? (
          <Card title={editing ? 'Edit Language':'Add New Language'}>
            <LanguageForm language={editing} />
            {editing ? (
              <div className="pt-4">
                <Link
                  href={ROUTES['languages.index']}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Phrase>Cancel</Phrase>
                </Link>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
