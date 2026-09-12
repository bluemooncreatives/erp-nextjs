'use client';

// The Bootstrap `nav custom_nav` / `tab-content` pair the Settings and payment
// method screens used, as a client component. Panels are rendered on the server
// and passed in as children, so nothing about the data flow changes.

import { useState, type ReactNode } from 'react';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({
  tabs,
  initial,
  orientation = 'vertical',
}: {
  tabs: TabItem[];
  initial?: string;
  orientation?: 'vertical' | 'horizontal';
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const list = (
    <div
      role="tablist"
      className={
        orientation === 'vertical'
          ? 'flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]'
          : 'flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.03]'
      }
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === current?.id}
          onClick={() => setActive(tab.id)}
          className={`rounded-lg px-4 py-2.5 text-left text-sm font-medium transition ${
            tab.id === current?.id
              ? 'bg-brand-500 text-white shadow-theme-xs'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (orientation === 'horizontal') {
    return (
      <div className="space-y-5">
        {list}
        <div role="tabpanel">{current?.content}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {list}
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
