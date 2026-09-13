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

import { createContext, useCallback, useContext, type ReactNode } from 'react';

export type Dictionary = Record<string, string>;

export type Translate = (
  key: string,
  replace?: Record<string, string | number>,
) => string;

const TranslationContext = createContext<Dictionary>({});

export function TranslationProvider({
  dictionary,
  children,
}: {
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <TranslationContext.Provider value={dictionary}>
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
  const dictionary = useContext(TranslationContext);

  return useCallback(
    (key, replace = {}) => {
      const known = dictionary[key];
      if (typeof known === 'string') return applyReplacements(known, replace);

      // `__('common.Add New')` with nothing loaded prints "Add New": the keys
      // are the English source strings, so the tail is the right fallback.
      const dot = key.indexOf('.');
      return applyReplacements(dot < 0 ? key : key.slice(dot + 1), replace);
    },
    [dictionary],
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
