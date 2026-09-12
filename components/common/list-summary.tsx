import { Files, ListFilter, Wallet, CircleCheck } from 'lucide-react';
import { StatCard, StatGrid } from './stat-card';

export function ListSummary({ total, visible, amount, amountLabel = 'Value on this page', statusCount, statusLabel = 'Approved on this page' }: {
  total: number; visible: number; amount?: string; amountLabel?: string; statusCount?: number; statusLabel?: string;
}) {
  return <StatGrid columns={4} className="mb-6">
    <StatCard label="Matching records" value={total.toLocaleString('en-US')} icon={Files} detail="Across all result pages" />
    <StatCard label="Showing now" value={visible} icon={ListFilter} detail="Records on this page" />
    {amount !== undefined ? <StatCard label={amountLabel} value={amount} icon={Wallet} /> : null}
    {statusCount !== undefined ? <StatCard label={statusLabel} value={statusCount} icon={CircleCheck} /> : null}
  </StatGrid>;
}
