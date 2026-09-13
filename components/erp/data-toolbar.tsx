'use client';

// ---------------------------------------------------------------------------
// The control bar above a listing - the design system's `DataToolbar`, driven
// by the URL instead of local state.
//
// ERP listings are server-rendered and filter through query parameters, so
// every control here writes a parameter and lets the server re-query: the back
// button, a bookmark and a shared link all keep the filters. Typing is
// debounced locally so the field stays responsive between navigations.
//
// The part the old `SearchBar` never had is the chip row: which filters are
// actually on, each one clearable on its own, plus "Clear all".
// ---------------------------------------------------------------------------

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/common/status-badge';
import { cn } from '@/components/ui/utils';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  /** Query parameter this filter writes. */
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  /** The value meaning "no filter" - dropped from the URL. Defaults to "all". */
  allValue?: string;
  className?: string;
}

export interface DataToolbarProps {
  search?: {
    /** Query parameter the term is written to. Defaults to "search". */
    name?: string;
    value?: string;
    label?: string;
    placeholder?: string;
    /** Milliseconds before a keystroke reaches the URL. 0 navigates per key. */
    debounceMs?: number;
  };
  filters?: FilterDefinition[];
  /** Buttons on the right - "New ...", export, print. */
  actions?: ReactNode;
  /** Result counter, e.g. "12 of 48", shown beside the chips. */
  resultLabel?: ReactNode;
  className?: string;
}

export function DataToolbar({
  search,
  filters = [],
  actions,
  resultLabel,
  className,
}: DataToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchName = search?.name ?? 'search';
  const searchValue = search?.value ?? '';

  /** Writes the given parameters and re-queries. Paging always resets: a
   *  filtered list is a different list, and page 4 of it rarely exists. */
  const apply = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  const activeFilters = filters.filter((filter) => filter.value !== (filter.allValue ?? 'all'));
  const hasActiveSearch = Boolean(searchValue);
  const showChips = activeFilters.length > 0 || hasActiveSearch;

  const clearAll = () => {
    const changes: Record<string, undefined> = { [searchName]: undefined };
    for (const filter of filters) changes[filter.id] = undefined;
    apply(changes);
  };

  return (
    <div className={cn('border-b', isPending && 'opacity-70 transition-opacity', className)}>
      <div className="flex flex-wrap items-end gap-3 p-4">
        {search ? (
          <ToolbarSearch
            {...search}
            value={searchValue}
            onCommit={(value) => apply({ [searchName]: value || undefined })}
          />
        ) : null}

        {filters.map((filter) => {
          const triggerId = `filter-${filter.id}`;
          const allValue = filter.allValue ?? 'all';
          return (
            <div
              key={filter.id}
              className={cn('w-full space-y-2 sm:w-44 sm:shrink-0', filter.className)}
            >
              <Label htmlFor={triggerId} className="text-xs font-medium">
                {filter.label}
              </Label>
              <Select
                value={filter.value}
                onValueChange={(value) =>
                  apply({ [filter.id]: value === allValue ? undefined : value })
                }
              >
                <SelectTrigger id={triggerId} className="w-full">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        {actions ? (
          <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {showChips || resultLabel ? (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {resultLabel ? (
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {resultLabel}
            </span>
          ) : null}

          {hasActiveSearch ? (
            <StatusBadge tone="brand">
              <span className="max-w-48 truncate">Search: {searchValue}</span>
              <button
                type="button"
                onClick={() => apply({ [searchName]: undefined })}
                className="hover:bg-primary/20 focus-visible:ring-primary -me-0.5 rounded-full p-0.5 focus:outline-none focus-visible:ring-2"
                aria-label="Clear search filter"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </StatusBadge>
          ) : null}

          {activeFilters.map((filter) => {
            const option = filter.options.find((candidate) => candidate.value === filter.value);
            return (
              <StatusBadge key={filter.id} tone="brand">
                <span className="max-w-48 truncate">
                  {filter.label}: {option?.label ?? filter.value}
                </span>
                <button
                  type="button"
                  onClick={() => apply({ [filter.id]: undefined })}
                  className="hover:bg-primary/20 focus-visible:ring-primary -me-0.5 rounded-full p-0.5 focus:outline-none focus-visible:ring-2"
                  aria-label={`Clear ${filter.label} filter`}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </StatusBadge>
            );
          })}

          {showChips ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-sm text-xs font-medium hover:underline focus:outline-none focus-visible:ring-2"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Search field with local state, so typing stays responsive while debounced. */
function ToolbarSearch({
  value,
  label = 'Search',
  placeholder = 'Search',
  debounceMs = 350,
  onCommit,
}: NonNullable<DataToolbarProps['search']> & { value: string; onCommit: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const isEditing = useRef(false);

  // Keep in step when the URL changes from elsewhere ("Clear all", the back
  // button), without fighting the user mid-keystroke.
  useEffect(() => {
    if (!isEditing.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!isEditing.current) return;
    if (draft === value) return;
    if (debounceMs <= 0) {
      onCommit(draft);
      return;
    }
    const timer = window.setTimeout(() => onCommit(draft), debounceMs);
    return () => window.clearTimeout(timer);
    // `onCommit` is deliberately excluded: callers pass inline arrows, and
    // re-running on every render would restart the debounce forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, debounceMs, value]);

  return (
    // Search takes the row's leftover width rather than a fixed column, so the
    // bar reaches the card's right edge instead of clustering left.
    <div className="w-full space-y-2 sm:min-w-64 sm:flex-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            isEditing.current = true;
            setDraft(event.target.value);
          }}
          onBlur={() => {
            isEditing.current = false;
          }}
          className="ps-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {draft ? (
          <button
            type="button"
            onClick={() => {
              isEditing.current = true;
              setDraft('');
              onCommit('');
            }}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary absolute top-1/2 end-2 -translate-y-1/2 rounded-sm p-1 focus:outline-none focus-visible:ring-2"
            aria-label="Clear search"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
