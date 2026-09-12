import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/components/ui/utils";

/** admin-main's settings-block pattern (heading in col 1, controls in cols 2-3, `my-10` between) — hand-repeated ten times there. */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-10", className)}>
      <div className="flex flex-col space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      <div className="space-y-6 lg:col-span-2">{children}</div>
    </section>
  );
}

/** The `my-10` rule admin-main puts between settings blocks. */
export function SettingsDivider() {
  return <Separator className="my-10" />;
}

/** One labelled control row — "title + explanation left, switch right". */
export function SettingsRow({
  title,
  description,
  control,
  className,
}: {
  title: string;
  description?: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
