// Translation editor - port of LanguageController@show plus
// @get_translate_file / @key_value_store (`localization::languages.translate_view`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findLanguage } from '@/lib/setting/repository';
import { translatableGroups, translationPairs } from '@/lib/i18n';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { FormAlert } from '@/components/erp/fields';
import { saveLanguagePhrases } from '../../actions';
import { TranslateForm } from '../../forms';

export const metadata: Metadata = { title: 'Translation' };

export default async function TranslateViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; saved?: string }>;
}) {
  await authorize('language.translate_view');

  const { id } = await params;
  const sp = await searchParams;

  const language = await findLanguage(Number(id));
  if (!language) notFound();

  const groups = await translatableGroups();
  const active = sp.file && groups.includes(sp.file) ? sp.file : groups[0];
  const pairs = active ? await translationPairs(language.code, active) : [];

  const base = route('language.translate_view', { id: language.id });

  return (
    <>
      <PageHeader
        title={`Translation - ${language.name}`}
        breadcrumb={[
          { label: 'Settings' },
          { label: 'Languages', href: ROUTES['languages.index'] },
          { label: language.name },
        ]}
      />

      {sp.saved ? (
        <div className="mb-5">
          <FormAlert variant="success" message="Operation Successfully done" />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card title="Files" bodyClassName="p-3">
          <div className="flex flex-col gap-1">
            {groups.map((group) => (
              <Link
                key={group}
                href={`${base}?file=${encodeURIComponent(group)}`}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  group === active
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted  '
                }`}
              >
                {group}
              </Link>
            ))}
          </div>
        </Card>

        <Card title={active ? `${active} (${pairs.length} phrases)` : 'Phrases'}>
          {active ? (
            <TranslateForm
              languageId={language.id}
              group={active}
              pairs={pairs}
              action={saveLanguagePhrases}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No translatable files found.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
