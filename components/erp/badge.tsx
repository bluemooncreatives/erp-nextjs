// ---------------------------------------------------------------------------
// Status pill.
//
// Fifty-odd screens label rows with one of the PHP app's status colours
// (`success`, `error`, `warning`, ...), so that vocabulary is what this
// component takes. Each colour resolves to a semantic token rather than a fixed
// palette entry, which is what makes a status read the same everywhere and
// follow the theme an admin picks under Appearance.
// ---------------------------------------------------------------------------

import React, { type ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

export type BadgeColor =
  | 'primary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

/** `light` is the list/table treatment; `solid` is for emphasis. */
export type BadgeVariant = 'light' | 'solid';

const SOFT: Record<BadgeColor, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
  light: 'bg-muted text-muted-foreground border-border',
  dark: 'bg-foreground/10 text-foreground border-foreground/20',
};

const SOLID: Record<BadgeColor, string> = {
  primary: 'bg-primary text-primary-foreground border-transparent',
  success: 'bg-success text-success-foreground border-transparent',
  error: 'bg-destructive text-destructive-foreground border-transparent',
  warning: 'bg-warning text-warning-foreground border-transparent',
  info: 'bg-info text-info-foreground border-transparent',
  light: 'bg-muted text-muted-foreground border-transparent',
  dark: 'bg-foreground text-background border-transparent',
};

export function Badge({
  variant = 'light',
  color = 'primary',
  size = 'md',
  startIcon,
  endIcon,
  className,
  children,
}: {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  color?: BadgeColor;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm',
        variant === 'solid' ? SOLID[color] : SOFT[color],
        className,
      )}
    >
      {startIcon}
      {children}
      {endIcon}
    </span>
  );
}

export default Badge;
