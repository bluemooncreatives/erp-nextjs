import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

/** Icon-in-a-square leading mark — six screens built this inline at slightly different sizes instead of one component. */
export type IconTileSize = "sm" | "default" | "lg";
export type IconTileTone = "muted" | "primary";

export interface IconTileProps {
  icon: ReactNode;
  size?: IconTileSize;
  tone?: IconTileTone;
  className?: string;
}

const SIZE_CLASS: Record<IconTileSize, string> = {
  sm: "size-7",
  default: "size-8",
  lg: "size-9",
};

const TONE_CLASS: Record<IconTileTone, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
};

export function IconTile({ icon, size = "default", tone = "muted", className }: IconTileProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
