// ---------------------------------------------------------------------------
// Dashboard - port of HomeController@index and resources/views/home.blade.php.
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
import { db } from '@/lib/db/client';
import { contacts, users } from '@/lib/db/schema';
import { requireUser, userCan } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { generalSetting, numberFormat } from '@/lib/settings';
import { dateConvert } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import {
  approvedPurchaseCount,
  approvedSalesCount,
  dailySales,
  expenseTotal,
  monthlySales,
  profitSeries,
  purchasePaymentTotals,
  purchaseTotals,
  saleDueList,
  salePaymentTotals,
  saleTotalPayable,
  stockAlerts,
  stockByBranch,
  todoList,
  totalBank,
  totalCash,
  type DashboardScope,
} from '@/lib/dashboard/queries';
import { MetricGrid, type Metric } from '@/components/dashboard/metrics';
import {
  BranchStockChart,
  ProfitChart,
  SalesChart,
} from '@/components/dashboard/charts';
import { Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Dashboard' };

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

  const money = (value: number) => `${symbol} ${numberFormat(value)}`;

  // --- Metric tiles -------------------------------------------------------
  const [purchase, sale, expense, saleDue, purchaseDue, bank, cash] =
    await Promise.all([
      purchaseTotals(scope),
      salePaymentTotals(scope, 'all'),
      expenseTotal(scope, 'all'),
      saleTotalPayable(scope, 'all'),
      purchasePaymentTotals(scope, 'all'),
      totalBank('all'),
      totalCash(scope, 'all'),
    ]);

  const allMetrics: Array<Metric & { permission: string }> = [
    {
      key: 'total_purchase',
      permission: 'widget.total_purchase',
      label: 'Total Purchase',
      value: money(purchase.net),
      icon: 'purchase',
    },
    {
      key: 'total_sale',
      permission: 'widget.total_sale',
      label: 'Total Sale',
      value: money(sale.net),
      icon: 'sale',
    },
    {
      key: 'expense',
      permission: 'widget.expense',
      label: 'Expense',
      value: money(expense),
      icon: 'expense',
    },
    {
      key: 'purchase_due',
      permission: 'widget.purchase_due',
      label: 'Purchase Due',
      value: money(purchaseDue.net),
      icon: 'due',
    },
    {
      key: 'invoice_due',
      permission: 'widget.invoice_due',
      label: 'Invoice Due',
      value: money(saleDue - sale.net),
      icon: 'due',
    },
    {
      key: 'total_in_bank',
      permission: 'widget.total_in_bank',
      label: 'Total in Bank',
      value: money(bank),
      icon: 'bank',
    },
    {
      key: 'total_in_cash',
      permission: 'widget.total_in_cash',
      label: 'Total in Cash',
      value: money(cash),
      icon: 'cash',
    },
    {
      key: 'net_profit',
      permission: 'widget.net_profit',
      label: 'Net Profit',
      value: money(sale.net - purchase.net - expense),
      icon: 'bank',
    },
  ];

  const metrics = allMetrics.filter((m) => userCan(user, m.permission));

  // --- Panels -------------------------------------------------------------
  const showSaleStats = userCan(user, 'sale_statistics');
  const showProfitStats = userCan(user, 'profit_statistics');
  const showBranchStock = userCan(user, 'showroom_wise_product_qty');
  const showDueList = userCan(user, 'payment_due_list');
  const showStockAlerts = userCan(user, 'stock_alert_list');
  const showTodos = userCan(user, 'to_do_list');

  const [daily, monthly] = showSaleStats
    ? await Promise.all([dailySales(scope), monthlySales(scope)])
    : [[], []];

  const profit = showProfitStats ? await profitSeries(scope, 'monthly') : null;
  const branchStock = showBranchStock ? await stockByBranch() : [];
  const dues = showDueList ? await saleDueList(scope, 10) : [];
  const alerts = showStockAlerts ? await stockAlerts(scope, 10) : [];
  const todos = showTodos ? await todoList() : [];

  // Resolve the customer / agent name for each due invoice.
  const customerIds = dues.map((d) => d.customerId).filter((v): v is number => v != null);
  const agentIds = dues.map((d) => d.agentUserId).filter((v): v is number => v != null);

  const customerNames = customerIds.length
    ? new Map(
        (
          await db
            .select({ id: contacts.id, name: contacts.name })
            .from(contacts)
            .where(inArray(contacts.id, customerIds))
        ).map((c) => [c.id, c.name]),
      )
    : new Map<number, string>();

  const agentNames = agentIds.length
    ? new Map(
        (
          await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, agentIds))
        ).map((u) => [u.id, u.name]),
      )
    : new Map<number, string>();

  const salesCount = await approvedSalesCount(scope);
  const purchaseCount = await approvedPurchaseCount(scope);

  // Dates run through `dateConvert()` (the configured PHP date format); resolve
  // them up front so the JSX stays synchronous.
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

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12">
        <MetricGrid metrics={metrics} />
      </div>

      {showSaleStats ? (
        <>
          <div className="col-span-12 xl:col-span-7">
            <SalesChart
              title="Current Month Sales"
              seriesName="Sales"
              labels={daily.map((d) => String(d.day))}
              data={daily.map((d) => Number(d.totalSell))}
              currencySymbol={symbol}
            />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <SalesChart
              title="Current Year Sales"
              seriesName="Sales"
              labels={monthly.map((m) => m.monthName)}
              data={monthly.map((m) => Number(m.totalSell))}
              currencySymbol={symbol}
            />
          </div>
        </>
      ) : null}

      {showProfitStats && profit ? (
        <div className="col-span-12 xl:col-span-7">
          <ProfitChart
            title="Profit Statistics (this month)"
            labels={profit.labels}
            mainAmount={profit.mainAmount}
            saleAmount={profit.saleAmount}
            currencySymbol={symbol}
          />
        </div>
      ) : null}

      {showBranchStock ? (
        <div className="col-span-12 xl:col-span-5">
          <BranchStockChart
            title="Branch Wise Product Quantity"
            labels={branchStock.map((b) => `${b.name} (${b.total})`)}
            data={branchStock.map((b) => b.total)}
          />
        </div>
      ) : null}

      <div className="col-span-12 xl:col-span-7">
        {showDueList ? (
          <Card
            title="Payment Due List"
            desc={`${salesCount} approved sales, ${purchaseCount} received purchases`}
            bodyClassName=""
            actions={
              <Link
                href={ROUTES['sale.due.list']}
                className="text-sm font-medium text-primary hover:text-primary"
              >
                View all
              </Link>
            }
          >
            <DataTable
              columns={[
                { label: 'Invoice' },
                { label: 'Date' },
                { label: 'Customer' },
                { label: 'Payable' },
                { label: 'Status' },
              ]}
              isEmpty={dueRows.length === 0}
              empty="No due invoices."
            >
              {dueRows.map((due) => (
                <Tr key={due.id}>
                  <Td>
                    <Link
                      href={ROUTES['sale.show'].replace('{id}', String(due.id))}
                      className="font-medium text-primary hover:text-primary"
                    >
                      {due.invoiceNo ?? due.id}
                    </Link>
                  </Td>
                  <Td>{due.dateLabel}</Td>
                  <Td>{due.partyName}</Td>
                  <Td>{money(Number(due.payableAmount))}</Td>
                  <Td>
                    <Badge color={due.status === 2 ? 'warning':'error'} size="sm">
                      {due.status === 2 ? 'Partial':'Unpaid'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        ) : null}
      </div>

      <div className="col-span-12 xl:col-span-5 flex flex-col gap-4 md:gap-6">
        {showStockAlerts ? (
          <Card title="Stock Alert List" bodyClassName="">
            <DataTable
              columns={[{ label: 'SKU' }, { label: 'In stock'}, { label:'Alert at' }]}
              isEmpty={alerts.length === 0}
              empty="No stock alerts."
            >
              {alerts.map((alert) => (
                <Tr key={alert.id}>
                  <Td className="font-medium text-foreground">
                    {alert.sku ?? alert.productSkuId}
                  </Td>
                  <Td>{alert.stock}</Td>
                  <Td>{alert.alertQuantity ?? '-'}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        ) : null}

        {showTodos ? (
          <Card title="To Do List" bodyClassName="p-4 sm:p-6">
            {todoRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing on the list.
              </p>
            ) : (
              <ul className="space-y-3">
                {todoRows.map((todo) => (
                  <li key={todo.id} className="flex items-start justify-between gap-3">
                    <span
                      className={`text-sm ${
                        todo.status === 1
                          ? 'text-muted-foreground line-through '
                          : 'text-foreground '
                      }`}
                    >
                      {todo.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {todo.dateLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
