import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";

export interface LinkCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

/** Whole-card link, entire card highlighted on hover — from `AdminConsole`'s row, extracted so `WorkspaceSettings` stops looking different. */
export function LinkCard({ to, icon: Icon, title, description, className }: LinkCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "hover:ring-primary/40 focus-within:ring-primary group transition-[box-shadow,--tw-ring-color] focus-within:ring-2",
        className,
      )}
    >
      <CardContent>
        <Link href={to} className="flex items-start gap-3 focus:outline-none">
          <span className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary rounded-md p-2 transition-colors">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="text-foreground block text-sm font-medium">{title}</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}
