import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

/** One badge for every status. Each screen used to carry its own raw-palette
 *  `statusStyles`, so "completed" was a different green everywhere — a tone here resolves to a semantic token instead. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONE_SOFT: Record<StatusTone, string> = {
  neutral: "bg-neutral/10 text-neutral border-neutral/20",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  brand: "bg-primary/10 text-primary border-primary/20",
};

const TONE_SOLID: Record<StatusTone, string> = {
  neutral: "bg-neutral text-neutral-foreground border-transparent",
  info: "bg-info text-info-foreground border-transparent",
  success: "bg-success text-success-foreground border-transparent",
  warning: "bg-warning text-warning-foreground border-transparent",
  danger: "bg-destructive text-destructive-foreground border-transparent",
  brand: "bg-primary text-primary-foreground border-transparent",
};

const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-neutral",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  brand: "bg-primary",
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  /** `soft` is the default list/table treatment; `solid` is for emphasis. */
  variant?: "soft" | "solid";
  /** Adds a leading state dot — useful when the label alone is ambiguous. */
  dot?: boolean;
  /** `xs` is the compact uppercase micro-label treatment ("AVAILABLE", "SOON") — distinct from `sm`/`md`'s normal case. */
  size?: "xs" | "sm" | "md";
  className?: string;
  children: ReactNode;
}

export function StatusBadge({
  tone = "neutral",
  variant = "soft",
  dot = false,
  size = "sm",
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border",
        size === "xs"
          ? "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          : size === "sm"
            ? "px-2 py-0.5 text-xs font-medium"
            : "px-2.5 py-1 text-sm font-medium",
        variant === "solid" ? TONE_SOLID[tone] : TONE_SOFT[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            variant === "solid" ? "bg-current" : TONE_DOT[tone],
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

/** Turns snake_case / SCREAMING_CASE status keys into readable labels. */
export function humanizeStatus(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Shared status vocabulary — screens map their own values onto a tone here instead of inventing colours, so status meaning can't drift. */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // Lifecycle
  active: "success",
  completed: "success",
  complete: "success",
  passed: "success",
  pass: "success",
  approved: "success",
  verified: "success",
  paid: "success",
  delivered: "success",
  resolved: "success",
  online: "success",
  healthy: "success",
  succeeded: "success",

  pending: "warning",
  pending_id_verification: "warning",
  in_review: "warning",
  review: "warning",
  maybe: "warning",
  warning: "warning",
  trial: "warning",
  trialing: "warning",
  past_due: "warning",
  degraded: "warning",
  queued: "warning",
  scheduled: "warning",
  waiting: "warning",
  open: "warning",

  in_progress: "info",
  processing: "info",
  running: "info",
  sent: "info",
  draft: "info",
  new: "info",

  failed: "danger",
  fail: "danger",
  error: "danger",
  cancelled: "danger",
  canceled: "danger",
  rejected: "danger",
  expired: "danger",
  suspended: "danger",
  overdue: "danger",
  blocked: "danger",
  critical: "danger",
  down: "danger",
  high: "danger",

  inactive: "neutral",
  none: "neutral",
  archived: "neutral",
  closed: "neutral",
  unknown: "neutral",
  low: "success",
  medium: "warning",
};

/** Best-effort tone for a raw status string; falls back to neutral. */
export function toneForStatus(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return TONE_BY_STATUS[status.toLowerCase().replace(/\s+/g, "_")] ?? "neutral";
}

/** Convenience wrapper: give it the raw status, it picks tone and label; pass `label` to override domain-specific wording. */
export function AutoStatusBadge({
  status,
  label,
  ...rest
}: Omit<StatusBadgeProps, "children" | "tone"> & {
  status: string | null | undefined;
  label?: string;
}) {
  const text = label ?? (status ? humanizeStatus(status) : "Unknown");
  return (
    <StatusBadge tone={toneForStatus(status)} {...rest}>
      {text}
    </StatusBadge>
  );
}
