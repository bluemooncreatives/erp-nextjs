// ---------------------------------------------------------------------------
// The figures a report is about, as tiles above its table.
//
// The PHP reports put their totals in the panel's heading - "Sales (30) -
// $6,820.00 billed, $2,910.00 collected" - where the numbers that matter most
// read as part of a sentence. The same figures get a tile each here, which is
// how every other summary in the product is presented.
// ---------------------------------------------------------------------------

import type { LucideIcon } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/common/stat-card';

export type ReportFigure = {
  label: string;
  value: string | number;
  /** The line under the figure - what it is measured over. */
  detail?: string;
  icon?: LucideIcon;
};

export function ReportSummary({
  figures,
  className,
}: {
  figures: ReportFigure[];
  className?: string;
}) {
  if (figures.length === 0) return null;

  const columns = Math.min(Math.max(figures.length, 2), 6) as 2 | 3 | 4 | 5 | 6;

  return (
    <StatGrid columns={columns} className={className ?? 'mb-6'}>
      {figures.map((figure) => (
        <StatCard
          key={figure.label}
          label={figure.label}
          value={figure.value}
          detail={figure.detail}
          icon={figure.icon}
        />
      ))}
    </StatGrid>
  );
}
