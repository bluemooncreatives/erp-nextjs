'use client';

// The Bootstrap `nav custom_nav` / `tab-content` pair the Settings and payment
// method screens used, as a client component. Panels are rendered on the server
// and passed in as children, so nothing about the data flow changes.

import { useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/utils';

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
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  const list = (
    <Card
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        'gap-1 p-2',
        orientation === 'vertical' ? 'flex flex-col' : 'flex flex-row flex-wrap',
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === current?.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setActive(tab.id)}
            className={cn(
              'rounded-md px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </Card>
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
