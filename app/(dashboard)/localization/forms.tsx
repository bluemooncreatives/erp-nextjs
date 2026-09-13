'use client';

// The Localization screen's forms - ports of `localization::languages.index`'s
// add modal, `edit_modal` and `modals.translate_modal`.

import { useActionState, useState } from 'react';
import { FormAlert, FormInput, FormActions } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { saveLanguage, type LanguageFormState } from './actions';

const EMPTY: LanguageFormState = {};

export function LanguageForm({
  language,
}: {
  language?: { id: number; name: string; code: string; native: string } | null;
}) {
  const [state, action] = useActionState(saveLanguage, EMPTY);

  return (
    <form action={action} className="space-y-5" key={language?.id ?? 'new'}>
      {language ? <input type="hidden" name="id" value={language.id} /> : null}
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <FormInput
        label="Name"
        name="name"
        defaultValue={language?.name ?? ''}
        placeholder="Name"
        required
        error={state.fieldErrors?.name}
      />
      <FormInput
        label="Code"
        name="code"
        defaultValue={language?.code ?? ''}
        placeholder="Code"
        required
        error={state.fieldErrors?.code}
      />
      <FormInput
        label="Native Name"
        name="native"
        defaultValue={language?.native ?? ''}
        placeholder="Native Name"
        required
        error={state.fieldErrors?.native}
      />

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

/**
 * `modals.translate_modal` - the phrase editor. Every default phrase is listed
 * with the locale's current value, posted back as `key[<phrase>]`.
 */
export function TranslateForm({
  languageId,
  group,
  pairs,
  action,
}: {
  languageId: number;
  group: string;
  pairs: Array<{ key: string; source: string; value: string }>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const matches = (p: { key: string; value: string }) =>
    !needle ||
    p.key.toLowerCase().includes(needle) ||
    p.value.toLowerCase().includes(needle);
  const visibleCount = pairs.filter(matches).length;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={languageId} />
      <input type="hidden" name="translatable_file_name" value={group} />

      <input
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter phrases"
        className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/50"
      />

      {/* Filtered-out rows stay mounted so every phrase is still posted back,
          which is what `key_value_store` rewrote the whole file from. */}
      <div className="max-h-[32rem] space-y-3 overflow-y-auto pe-1">
        {pairs.map((pair) => (
          <div
            key={pair.key}
            hidden={!matches(pair)}
            className="grid gap-3 sm:grid-cols-2 sm:items-center"
          >
            <p className="text-sm text-muted-foreground">{pair.source}</p>
            <input
              name={`key[${pair.key}]`}
              defaultValue={pair.value}
              className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground shadow-xs focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/50"
            />
          </div>
        ))}
        {visibleCount === 0 ? (
          <p className="text-sm text-muted-foreground">No phrases match.</p>
        ) : null}
      </div>

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}
