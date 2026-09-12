"use client";

import { ReactNode, ReactElement, cloneElement, Children, isValidElement } from "react";
import { ChevronDown, Filter } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface FilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

interface FilterDropdownItemProps {
  value: string;
  children: ReactNode;
  onSelect?: () => void;
}

export function FilterDropdownItem({ children, onSelect }: FilterDropdownItemProps) {
  return (
    <DropdownMenu.Item
      className="px-3 py-2 text-sm text-foreground hover:bg-accent cursor-pointer rounded outline-none"
      onSelect={onSelect}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function FilterDropdown({ label, value, onChange, children }: FilterDropdownProps) {
  const displayValue = value === label ? label : value;
  
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Filter className="w-3.5 h-3.5" />
          {displayValue}
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-popover border border-border rounded-md shadow-lg p-1 z-50"
          sideOffset={5}
          align="start"
        >
          {Children.map(children, (child, index) => {
            if (!isValidElement(child)) return child;
            // React 19 types `props` as `unknown`; each item is one of this
            // file's own `FilterItem`s, so its shape is known here.
            const item = child as ReactElement<{ value: string }>;
            return cloneElement(item, {
              key: `filter-item-${index}`,
              ...item.props,
              onSelect: () => onChange(item.props.value),
            } as Partial<{ value: string }>);
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}