"use client";

import { useState, type ReactNode } from "react";
import { Tabs as UITabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/utils";

export type TabItem = { id: string; label: string; content: ReactNode };

/** Shared product tabs, with Radix focus management and linked tab panels. */
export function Tabs({ tabs, initial, orientation = "vertical" }: {
  tabs: TabItem[];
  initial?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id ?? "");
  const value = tabs.some((tab) => tab.id === active) ? active : tabs[0]?.id;
  const vertical = orientation === "vertical";
  return (
    <UITabs value={value} onValueChange={setActive} orientation={orientation}
      className={cn("min-w-0 gap-6", vertical && "lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start")}>
      <TabsList aria-label="Sections" className={cn("minimal-scrollbar h-auto max-w-full justify-start gap-1 overflow-x-auto p-1", vertical ? "w-full flex-row lg:sticky lg:top-20 lg:flex-col lg:items-stretch" : "w-fit")}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className={cn("h-9 flex-none px-3", vertical && "lg:justify-start")}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>
      <div className="min-w-0">
        {tabs.map((tab) => <TabsContent key={tab.id} value={tab.id} className="min-w-0 space-y-6">{tab.content}</TabsContent>)}
      </div>
    </UITabs>
  );
}
