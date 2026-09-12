// ---------------------------------------------------------------------------
// Dashboard metric tiles - the widget row from resources/views/home.blade.php.
//
// Each tile maps to one `widget.*` permission, so a role only sees the figures
// it was granted (widget.total_purchase, widget.total_sale, widget.expense,
// widget.purchase_due, widget.invoice_due, widget.total_in_bank,
// widget.total_in_cash, widget.net_profit).
// ---------------------------------------------------------------------------

import React from 'react';
import {
  BoxIconLine,
  DollarLineIcon,
  GroupIcon,
  PieChartIcon,
  ShootingStarIcon,
  TaskIcon,
} from '@/icons';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  purchase: BoxIconLine,
  sale: ShootingStarIcon,
  expense: DollarLineIcon,
  due: TaskIcon,
  bank: PieChartIcon,
  cash: GroupIcon,
};

export type Metric = {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof ICONS | string;
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = ICONS[metric.icon] ?? BoxIconLine;
        return (
          <div
            key={metric.key}
            className="rounded-2xl border border-border bg-card p-5 ] md:p-6"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-xl">
              <Icon className="text-foreground size-6" />
            </div>

            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-muted-foreground">
                  {metric.label}
                </span>
                <h4 className="mt-2 font-bold text-foreground text-2xl">
                  {metric.value}
                </h4>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
