// ---------------------------------------------------------------------------
// Dashboard - port of HomeController@index and resources/views/home.blade.php,
// laid out on the product design system's dashboard grid: the headline figure
// and its four supporting tiles, then throughput, then the breakdowns, then
// recent activity.
//
// Widgets are gated by the same `widget.*` / panel permissions the Blade view
// checked, and every figure is scoped to the session's branch.
//
// Normal users (suppliers and customers) are redirected to their own details
// page, exactly as `HomeController@index` did.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { inArray } from 'drizzle-orm';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { db } from '@/lib/db/client';
import { contacts, users } from '@/lib/db/schema';
import { requireUser, userCan } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { generalSetting, numberFormat } from '@/lib/settings';
import { dateConvert } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { periodOverPeriod } from '@/lib/trend';
import { EventCalendar } from '@/components/erp/event-calendar';
import { NAVIGATION, navHref, navPermission } from '@/lib/navigation';
import {
  approvedPurchaseCount,
  calendarEvents,
  approvedSalesCount,
  expenseTotal,
  monthlyPurchases,
  monthlySales,
  purchasePaymentTotals,
  purchaseTotals,
  saleDueList,
  salePaymentTotals,
  saleTotalPayable,
  stockAlerts,
  stockByBranch,
  todoList,
  topCustomers,
  totalBank,
  totalCash,
  type DashboardScope,
} from '@/lib/dashboard/queries';
import {
  BreakdownListCard,
  HighlightStatCard,
  RingListCard,
  StatisticsCard,
  TopCustomersCard,
  TrendReportCard,
  WeeklyOverviewCard,
  type StatAccent,
} from '@/components/dashboard';
import { NAV_ICONS } from '@/layout/nav-icons';
import { PageHeader, Section } from '@/components/common/page-header';
import { PrimaryCell } from '@/components/common/cells';
import { StatusBadge } from '@/components/common/status-badge';
import { DashboardActions, DashboardLink } from '@/components/dashboard/dashboard-actions';
import { Card as UICard } from '@/components/ui/card';
import { Card } from '@/components/erp/page';

export const metadata: Metadata = { title: 'Dashboard' };

/** Share of a total, as a whole percentage. A zero total reads as 0, not NaN. */
function ratio(part: number, total: number): number {
  if (!total || !part) return 0;
  return Math.round((part / total) * 100);
}

export default async function DashboardPage() {
  const user = await requireUser();

  // `if (auth()->user()->role->type == 'normal_user') return redirect()->route('contact.my_details');`
  if (user.role.type === 'normal_user') {
    redirect(ROUTES['contact.my_details']);
  }

  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const scope: DashboardScope = { showroomId: session?.showroomId ?? user.showroomId };

  const money = (value: number) => `${symbol} ${numberFormat(value)}`;
  // Client cards cannot take a formatter function across the server boundary,
  // so they are told how to print instead.
  const moneyFormat = { symbol, decimals: 2 };
  const compactFormat = { symbol, compact: true };

  const firstName = user.name.split(' ')[0] || 'there';

  // `roleWiseEvents()` - a system user sees every event, everyone else only
  // those addressed to all or to their own role.
  const calendar = await calendarEvents(
    user.role.type === 'system_user' ? null : user.role.name,
  );

  // --- Figures ------------------------------------------------------------
  const [purchase, sale, expense, saleDue, purchaseDue, bank, cash] = await Promise.all([
    purchaseTotals(scope),
    salePaymentTotals(scope, 'all'),
    expenseTotal(scope, 'all'),
    saleTotalPayable(scope, 'all'),
    purchasePaymentTotals(scope, 'all'),
    totalBank('all'),
    totalCash(scope, 'all'),
  ]);

  const invoiceDue = saleDue - sale.net;
  const netProfit = sale.net - purchase.net - expense;

  // --- Panel permissions --------------------------------------------------
  const showSaleStats = userCan(user, 'sale_statistics');
  const showProfitStats = userCan(user, 'profit_statistics');
  const showBranchStock = userCan(user, 'showroom_wise_product_qty');
  const showDueList = userCan(user, 'payment_due_list');
  const showStockAlerts = userCan(user, 'stock_alert_list');
  const showTodos = userCan(user, 'to_do_list');

  const [monthlySale, monthlyPurchase] =
    showSaleStats || showProfitStats
      ? await Promise.all([monthlySales(scope), monthlyPurchases(scope)])
      : [[], []];

  const branchStock = showBranchStock ? await stockByBranch() : [];
  const dues = showDueList ? await saleDueList(scope, 5) : [];
  const alerts = showStockAlerts ? await stockAlerts(scope, 5) : [];
  const todos = showTodos ? await todoList() : [];
  const customers = showSaleStats ? await topCustomers(scope, 5) : [];

  const salesCount = await approvedSalesCount(scope);
  const purchaseCount = await approvedPurchaseCount(scope);

  // The sale series drives both the trend chart and the headline tile's delta,
  // so the two can never disagree.
  const saleSeries = monthlySale.map((row) => Number(row.totalSell));
  const saleTrend = periodOverPeriod(saleSeries);

  // One row per month that either series has, so the bars and the line stay
  // aligned even when a month has purchases but no sales.
  const months = [
    ...new Map(
      [...monthlySale, ...monthlyPurchase].map((row) => [row.month, row.monthName]),
    ).entries(),
  ]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([month, monthName]) => ({
      day: monthName,
      invited: Number(monthlySale.find((row) => row.month === month)?.totalSell ?? 0),
      completed: Number(monthlyPurchase.find((row) => row.month === month)?.total ?? 0),
    }));

  // Dates run through `dateConvert()` (the configured PHP date format); resolve
  // them up front so the JSX stays synchronous.
  const customerIds = dues.map((due) => due.customerId).filter((v): v is number => v != null);
  const agentIds = dues.map((due) => due.agentUserId).filter((v): v is number => v != null);

  const customerNames = customerIds.length
    ? new Map(
        (
          await db
            .select({ id: contacts.id, name: contacts.name })
            .from(contacts)
            .where(inArray(contacts.id, customerIds))
        ).map((row) => [row.id, row.name]),
      )
    : new Map<number, string>();

  const agentNames = agentIds.length
    ? new Map(
        (
          await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, agentIds))
        ).map((row) => [row.id, row.name]),
      )
    : new Map<number, string>();

  const dueRows = await Promise.all(
    dues.map(async (due) => ({
      ...due,
      dateLabel: await dateConvert(due.date),
      partyName: due.customerId
        ? (customerNames.get(due.customerId) ?? '-')
        : due.agentUserId
          ? (agentNames.get(due.agentUserId) ?? '-')
          : '-',
    })),
  );

  const todoRows = await Promise.all(
    todos.map(async (todo) => ({ ...todo, dateLabel: await dateConvert(todo.date) })),
  );

  // --- Supporting tiles ---------------------------------------------------
  // Four tiles sit beside the headline figure; the permissions decide which
  // four, the same `widget.*` checks the Blade view made per tile.
  const tiles: Array<{
    permission: string;
    icon: React.ReactNode;
    value: string;
    title: string;
    detail: string;
  }> = [
    {
      permission: 'widget.total_purchase',
      icon: <ShoppingCart className="size-4" />,
      value: money(purchase.net),
      title: 'Total purchase',
      detail: `${purchaseCount} received`,
    },
    {
      permission: 'widget.expense',
      icon: <ReceiptText className="size-4" />,
      value: money(expense),
      title: 'Expense',
      detail: 'approved vouchers',
    },
    {
      permission: 'widget.invoice_due',
      icon: <FileText className="size-4" />,
      value: money(invoiceDue),
      title: 'Invoice due',
      detail: 'owed to you',
    },
    {
      permission: 'widget.net_profit',
      icon: <TrendingUp className="size-4" />,
      value: money(netProfit),
      title: 'Net profit',
      detail: 'after costs',
    },
    {
      permission: 'widget.purchase_due',
      icon: <CreditCard className="size-4" />,
      value: money(purchaseDue.net),
      title: 'Purchase due',
      detail: 'owed by you',
    },
    {
      permission: 'widget.total_in_bank',
      icon: <Landmark className="size-4" />,
      value: money(bank),
      title: 'Total in bank',
      detail: 'bank accounts',
    },
    {
      permission: 'widget.total_in_cash',
      icon: <Wallet className="size-4" />,
      value: money(cash),
      title: 'Total in cash',
      detail: 'cash accounts',
    },
  ]
    .filter((tile) => userCan(user, tile.permission))
    .slice(0, 4);

  const showHeadline = userCan(user, 'widget.total_sale');

  // The sidebar's own top-level entries, as shortcut cards.
  const modules = NAVIGATION.filter(
    (item) => item.kind === 'group' || navPermission(item) !== 'dashboard',
  )
    .filter((item) =>
      item.kind === 'link'
        ? userCan(user, navPermission(item))
        : userCan(user, item.permission) ||
          item.children.some(
            (child) => child.kind === 'link' && userCan(user, navPermission(child)),
          ),
    )
    .map((item) => {
      if (item.kind === 'link')
        return { label: item.label, href: navHref(item), icon: item.icon ?? 'grid' };
      const first = item.children.find(
        (child) => child.kind === 'link' && userCan(user, navPermission(child)),
      );
      return {
        label: item.label,
        icon: item.icon,
        href: first && first.kind === 'link' ? navHref(first) : null,
      };
    })
    .filter((item): item is { label: string; href: string; icon: string } => Boolean(item.href));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          <>
            {salesCount} approved sales and {purchaseCount} received purchases across{' '}
            {scope.showroomId && scope.showroomId !== 1
              ? (user.showroomName ?? 'this branch')
              : 'every branch'}
            .
          </>
        }
        actions={
          <DashboardActions createHref={ROUTES['sale.create']} reviewHref={ROUTES['sale.index']} />
        }
      />

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {/* The figure the row is about, leading it, with the supporting tiles
            taking the rest of the width. */}
        <div className="col-span-2 flex flex-col gap-6 lg:col-span-3 xl:flex-row xl:items-stretch">
          {showHeadline ? (
            <HighlightStatCard
              className="xl:w-72 xl:shrink-0"
              title="Total sale"
              caption="Received to date"
              value={money(sale.net)}
              change={saleTrend}
            />
          ) : null}

          {tiles.length > 0 ? (
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-6 lg:grid-cols-4">
              {tiles.map((tile, index) => (
                <StatisticsCard
                  key={tile.permission}
                  icon={tile.icon}
                  accent={((index % 5) + 1) as StatAccent}
                  value={tile.value}
                  title={tile.title}
                  badge={tile.detail}
                />
              ))}
            </div>
          ) : null}
        </div>

        {showSaleStats ? (
          <TrendReportCard
            className="col-span-2"
            gradientId="sales"
            trendTitle="Sales throughput"
            trendCaption="Invoiced per month, this year"
            seriesLabel="Sales"
            format={compactFormat}
            yAxisWidth={56}
            data={monthlySale.map((row) => ({
              label: row.monthName,
              value: Number(row.totalSell),
            }))}
            reportTitle="All time"
            reportCaption="Across every open invoice"
            rows={[
              {
                id: 'invoiced',
                label: 'Invoiced',
                value: money(saleDue),
                icon: <FileText />,
                accent: 1,
              },
              {
                id: 'received',
                label: 'Received',
                value: money(sale.net),
                icon: <CheckCircle2 />,
                accent: 2,
              },
              {
                id: 'due',
                label: 'Outstanding',
                value: money(invoiceDue),
                icon: <Banknote />,
                accent: 3,
              },
            ]}
          />
        ) : null}

        <BreakdownListCard
          className="max-sm:col-span-full md:max-lg:col-span-full"
          title="Cash position"
          caption={`${money(bank + cash)} on hand`}
          rows={[
            {
              id: 'bank',
              label: 'In bank',
              icon: <Landmark />,
              accent: 1,
              value: money(bank),
              meta: `${ratio(bank, bank + cash)}%`,
            },
            {
              id: 'cash',
              label: 'In cash',
              icon: <Wallet />,
              accent: 2,
              value: money(cash),
              meta: `${ratio(cash, bank + cash)}%`,
            },
            {
              id: 'invoice-due',
              label: 'Invoice due',
              icon: <FileText />,
              accent: 3,
              value: money(invoiceDue),
              meta: `${ratio(invoiceDue, saleDue)}%`,
            },
            {
              id: 'purchase-due',
              label: 'Purchase due',
              icon: <CreditCard />,
              accent: 4,
              value: money(purchaseDue.net),
              meta: `${ratio(purchaseDue.net, purchase.net)}%`,
            },
            {
              id: 'expense',
              label: 'Expense',
              icon: <ReceiptText />,
              accent: 5,
              value: money(expense),
              meta: `${ratio(expense, sale.net)}%`,
            },
          ]}
        />

        {showProfitStats ? (
          <WeeklyOverviewCard
            className="max-sm:col-span-full md:max-lg:col-span-full"
            title="Sales vs purchases"
            barLabel="Sales"
            lineLabel="Purchases"
            format={compactFormat}
            data={months}
            performancePercent={ratio(netProfit, sale.net)}
            performanceCaption={`margin on ${money(sale.net)} of all-time receipts`}
            detailsHref={ROUTES['sale.index']}
          />
        ) : null}

        {showBranchStock ? (
          <RingListCard
            className="max-sm:col-span-full md:max-lg:col-span-full"
            title="Stock by branch"
            rows={(() => {
              const largest = Math.max(...branchStock.map((row) => row.total), 1);
              return branchStock.slice(0, 5).map((row, index) => ({
                id: String(row.id),
                label: row.name ?? `Branch ${row.id}`,
                detail: `${numberFormat(row.total, 0)} units in stock`,
                // Against the busiest branch, so the rings compare with each
                // other - there is no absolute capacity to measure against.
                percentage: Math.round((row.total / largest) * 100),
                accent: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
                badge: `${Math.round((row.total / largest) * 100)}%`,
              }));
            })()}
          />
        ) : null}

        {showSaleStats ? (
          <TopCustomersCard
            className="max-sm:col-span-full md:max-lg:col-span-full"
            customers={customers.map((customer) => ({
              id: customer.id,
              name: customer.name,
              total: customer.total,
              detail: `${customer.invoices} invoice${customer.invoices === 1 ? '' : 's'}`,
            }))}
            format={moneyFormat}
            viewAllHref={ROUTES['add_contact.index']}
            summary={`${salesCount} approved sales to date.`}
          />
        ) : null}

        {showDueList ? (
          <UICard className="col-span-full w-full gap-0 py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold">Payment due list</h2>
                <p className="text-muted-foreground text-sm">
                  The five oldest invoices still owing.
                </p>
              </div>
              <DashboardLink variant="soft" size="sm" href={ROUTES['sale.due.list']}>
                  View all
                  <ArrowRight />
                </DashboardLink>
            </div>

            {dueRows.length === 0 ? (
              <div className="border-t px-6 py-12 text-center">
                <p className="font-medium">Nothing outstanding</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                  Every approved invoice has been paid in full.
                </p>
              </div>
            ) : (
              <>
              <div className="divide-border divide-y border-t xl:hidden">
                {dueRows.map((due) => (
                  <div key={due.id} className="space-y-3 px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <PrimaryCell title={due.partyName} subtitle={String(due.invoiceNo ?? due.id)} />
                      <StatusBadge tone={due.status === 2 ? 'warning' : 'danger'}>
                        {due.status === 2 ? 'Partial' : 'Unpaid'}
                      </StatusBadge>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{due.dateLabel}</span>
                      <span className="font-medium tabular-nums">{money(Number(due.payableAmount))}</span>
                      <DashboardLink variant="soft" size="sm" href={ROUTES['sale.show'].replace('{id}', String(due.id))}>Open invoice<ArrowRight /></DashboardLink>
                    </div>
                  </div>
                ))}
              </div>
              <div className="minimal-scrollbar hidden w-full overflow-x-auto border-t xl:block">
                <table className="table-unified w-full text-sm">
                  <caption className="sr-only">Invoices with an outstanding balance</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="h-14 pl-4 text-left sm:pl-6">
                        Customer
                      </th>
                      <th scope="col" className="h-14 text-left">
                        Invoice
                      </th>
                      <th scope="col" className="h-14 text-left">
                        Date
                      </th>
                      <th scope="col" className="h-14 text-right">
                        Payable
                      </th>
                      <th scope="col" className="h-14 text-center">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="h-14 w-[1%] pr-4 text-right whitespace-nowrap sm:pr-6"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueRows.map((due) => (
                      <tr key={due.id}>
                        <td className="pl-4 sm:pl-6">
                          <PrimaryCell title={due.partyName} />
                        </td>
                        <td className="text-muted-foreground">
                          {due.invoiceNo ?? due.id}
                        </td>
                        <td className="text-muted-foreground">{due.dateLabel}</td>
                        <td className="text-right font-medium tabular-nums">
                          {money(Number(due.payableAmount))}
                        </td>
                        <td className="text-center">
                          <StatusBadge tone={due.status === 2 ? 'warning' : 'danger'}>
                            {due.status === 2 ? 'Partial' : 'Unpaid'}
                          </StatusBadge>
                        </td>
                        <td className="pr-4 text-right sm:pr-6">
                          <DashboardLink variant="ghost" size="sm" href={ROUTES['sale.show'].replace('{id}', String(due.id))}>
                              Open
                            </DashboardLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </UICard>
        ) : null}
      </div>

      {showStockAlerts || showTodos ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {showStockAlerts ? (
            <Card title="Stock alert list" bodyClassName="">
              {alerts.length === 0 ? (
                <p className="text-muted-foreground px-6 py-10 text-center text-sm">
                  No stock alerts.
                </p>
              ) : (
                <table className="table-unified w-full">
                  <thead>
                    <tr>
                      <th className="text-left">SKU</th>
                      <th className="text-right">In stock</th>
                      <th className="text-right">Alert at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td className="font-medium">{alert.sku ?? alert.productSkuId}</td>
                        <td className="text-right tabular-nums">{alert.stock}</td>
                        <td className="text-muted-foreground text-right tabular-nums">
                          {alert.alertQuantity ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ) : null}

          {showTodos ? (
            <Card title="To do list">
              {todoRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing on the list.</p>
              ) : (
                <ul className="space-y-3">
                  {todoRows.map((todo) => (
                    <li key={todo.id} className="flex items-start justify-between gap-3">
                      <span
                        className={
                          todo.status === 1
                            ? 'text-muted-foreground text-sm line-through'
                            : 'text-sm'
                        }
                      >
                        {todo.title}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {todo.dateLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* The Blade dashboard carried a FullCalendar widget of holidays and
          events; the port had the query but no calendar. */}
      {calendar.length > 0 ? (
        <Section title="Calendar" headingLevel="h2">
          <Card bodyClassName="p-4 sm:p-5">
            <EventCalendar events={calendar} height={520} />
          </Card>
        </Section>
      ) : null}

      <Section title="Workspace" headingLevel="h2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = (module.icon ? NAV_ICONS[module.icon] : null) ?? ArrowRight;
            return (
            <Link
              key={module.href}
              href={module.href}
              className="group ring-foreground/10 bg-card hover:ring-primary/40 focus-visible:ring-primary flex items-start gap-3 rounded-xl p-4 shadow-xs ring-1 transition-colors focus:outline-none focus-visible:ring-2"
            >
              <span className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary rounded-md p-2 transition-colors">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{module.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">Open</span>
              </span>
            </Link>
          );
          })}
        </div>
      </Section>
    </div>
  );
}
