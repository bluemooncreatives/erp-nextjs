'use client';

// Translations for client components.
//
// A server component can `await trans('common.Save')`; a client component
// cannot, so the dashboard layout loads the active locale's phrases once and
// puts them here. The whole application is about 20KB gzipped, and because it
// hangs off the shared layout it is sent once rather than with every page.
//
// `t()` mirrors Laravel's `__()` exactly, including its forgiving behaviour:
// an unknown key renders the part after the first dot, which is the English
// source string, so a missing translation degrades to English rather than to
// `common.Save`.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

export type Dictionary = Record<string, string>;

export type Translate = (
  key: string,
  replace?: Record<string, string | number>,
) => string;

type Lookup = {
  /** `group.Phrase` -> translation. */
  byKey: Dictionary;
  /** `Phrase` -> translation, for callers that only have the English text. */
  byPhrase: Dictionary;
};

const TranslationContext = createContext<Lookup>({ byKey: {}, byPhrase: {} });

export function TranslationProvider({
  dictionary,
  children,
}: {
  dictionary: Dictionary;
  children: ReactNode;
}) {
  // The shared components - the page header, the table, the form fields - are
  // handed the English phrase, not `group.Phrase`: that is what every page
  // already passes them. Translating there rather than at 756 call sites is
  // what makes one edit reach every screen, and it needs a lookup that does
  // not care which group a phrase was filed under.
  //
  // Laravel resolved the group from the key, so two groups holding the same
  // phrase were independent. Here the first group that translates it wins,
  // which only differs from Laravel when two groups translate one phrase
  // differently - and in this application's packs, none do.
  const value = useMemo<Lookup>(() => {
    const byPhrase: Dictionary = {};
    for (const [key, translation] of Object.entries(dictionary)) {
      const dot = key.indexOf('.');
      const phrase = dot < 0 ? key : key.slice(dot + 1);
      if (translation !== phrase && !(phrase in byPhrase)) byPhrase[phrase] = translation;
    }
    return { byKey: dictionary, byPhrase };
  }, [dictionary]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

/** Laravel's `:attribute` placeholders. */
function applyReplacements(
  value: string,
  replace: Record<string, string | number>,
): string {
  let out = value;
  for (const [token, replacement] of Object.entries(replace)) {
    out = out.split(`:${token}`).join(String(replacement));
  }
  return out;
}

export function useTrans(): Translate {
  const { byKey, byPhrase } = useContext(TranslationContext);

  return useCallback(
    (key, replace = {}) => {
      const keyed = byKey[key];
      if (typeof keyed === 'string') return applyReplacements(keyed, replace);

      // `__('common.Add New')` with nothing loaded prints "Add New": the keys
      // are the English source strings, so the tail is the right fallback.
      const dot = key.indexOf('.');
      const phrase = dot < 0 ? key : key.slice(dot + 1);

      const byText = byPhrase[phrase];
      if (typeof byText === 'string') return applyReplacements(byText, replace);

      return applyReplacements(phrase, replace);
    },
    [byKey, byPhrase],
  );
}

/**
 * One translated phrase, for markup that is not inside a client component and
 * cannot await - a helper rendered by a server page, say. It is a client
 * component itself, so it reads the same context.
 */
export function T({
  k,
  replace,
}: {
  k: string;
  replace?: Record<string, string | number>;
}) {
  const t = useTrans();
  return <>{t(k, replace)}</>;
}

/**
 * Look up display text, not a `group.key`.
 *
 * `useTrans` treats everything before the first dot as a group, which is right
 * for `__('common.Save')` and wrong for text that merely contains a dot:
 * "Total $ 160.00" would come back as "00". Display text is looked up whole and
 * returned unchanged when nothing translates it.
 */
export function usePhrase(): (text: string) => string {
  const { byKey, byPhrase } = useContext(TranslationContext);

  return useCallback(
    (text) => byPhrase[text] ?? byKey[text] ?? text,
    [byKey, byPhrase],
  );
}

/**
 * Translate a phrase a shared component was handed.
 *
 * Anything that is not a plain string - a node, a number, nothing at all - is
 * returned untouched, so a caller passing markup keeps it.
 */
export function Phrase({ children }: { children: ReactNode }) {
  const phrase = usePhrase();
  return <>{typeof children === 'string' ? phrase(children) : children}</>;
}
