import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom action content — a text link, for instance — in place of `actionLabel`/`onAction`'s button. */
  action?: ReactNode;
  /** `card` (default) wraps in the standard shell; `bare` skips it — for use inside a container that's already a card. */
  variant?: "card" | "bare";
  /** `sm` is the compact treatment for tight spaces like a dropdown panel. */
  size?: "default" | "sm";
  className?: string;
}

/** The one empty-state shape — icon, title, description, action. Six screens
 *  hand-rolled this instead of reaching for it; `variant`/`size` cover the shapes those copies needed. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  variant = "card",
  size = "default",
  className,
}: EmptyStateProps) {
  const resolvedAction = action ?? (actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-4 py-10" : "gap-3 p-12",
        variant === "card" && "rounded-xl bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className={cn("rounded-full bg-muted", size === "sm" ? "p-2.5" : "p-3")}>
        <Icon className={cn("text-muted-foreground", size === "sm" ? "size-5" : "size-6")} aria-hidden="true" />
      </div>
      <div className={size === "sm" ? undefined : "space-y-1"}>
        <p className={cn("font-medium text-foreground", size === "sm" && "text-sm")}>{title}</p>
        {description ? (
          <p className={cn("mx-auto max-w-md text-muted-foreground", size === "sm" ? "text-xs" : "text-sm")}>
            {description}
          </p>
        ) : null}
      </div>
      {resolvedAction}
    </div>
  );
}
