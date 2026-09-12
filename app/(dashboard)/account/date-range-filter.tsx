import { ReportFilter } from '../report/report-filter';

export function DateRangeFilter({ action, from, to, accounts, accountId }: {
  action: string; from?: string; to?: string;
  accounts?: Array<{ value: number; label: string }>; accountId?: string;
}) {
  return <ReportFilter action={action} from={from} to={to} selects={accounts ? [{ name: 'account_id', placeholder: 'Account', value: accountId, options: accounts }] : []} />;
}
