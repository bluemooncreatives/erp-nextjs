// Loan history - port of ApplyLoanController@history and @loanDetails
// (`setup::approval_loans.history` and `.get_details`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { loanUsers, staffLoans } from '@/lib/hr/loans';
import { singlePrice, dateConvert } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import Badge from '@/components/ui/badge/Badge';

export const metadata: Metadata = { title: 'Loan History' };

export default async function LoanHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const users = await loanUsers();
  const selectedId = sp.user ? Number(sp.user) : null;
  const selected = selectedId ? users.find((u) => u.id === selectedId) ?? null : null;

  const loans = selectedId ? await staffLoans(selectedId) : [];
  const detail = await Promise.all(
    loans.map(async (row) => ({
      ...row,
      totalLabel: await singlePrice(row.loan.amount),
      paidLabel: await singlePrice(row.loan.paidLoanAmount),
      dueLabel: await singlePrice(
        row.loan.amount > row.loan.paidLoanAmount
          ? row.loan.amount - row.loan.paidLoanAmount
          : 0,
      ),
      installmentLabel: await singlePrice(row.loan.monthlyInstallment),
      applyDateLabel: await dateConvert(row.loan.applyDate),
    })),
  );

  return (
    <>
      <PageHeader
        title="Loan History"
        breadcrumb={[{ label: 'HR' }, { label: 'Loan History' }]}
      />

      <div className="space-y-5">
        <Card title={`Staff with loans (${users.length})`} bodyClassName="">
          <DataTable
            columns={[
              { label: 'ID' },
              { label: 'Name' },
              { label: 'Employee ID' },
              { label: 'Email' },
              { label: 'Phone' },
              { label: 'Role' },
              { label: 'Action' },
            ]}
            isEmpty={users.length === 0}
            empty="Nobody has taken a loan yet."
          >
            {users.map((user, index) => (
              <Tr key={user.id}>
                <Td>{index + 1}</Td>
                <Td className="font-medium text-gray-700 dark:text-gray-300">{user.name}</Td>
                <Td>{user.employeeId ?? '-'}</Td>
                <Td>{user.email ?? '-'}</Td>
                <Td>{user.phone ?? '-'}</Td>
                <Td>{user.roleName ?? '-'}</Td>
                <Td>
                  <Link
                    href={`${ROUTES['apply_loans.history']}?user=${user.id}`}
                    className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    View
                  </Link>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        {selected ? (
          <Card
            title={`Loan Detail's - (${selected.name})`}
            desc={[selected.email, selected.phone].filter(Boolean).join(' · ')}
            bodyClassName=""
          >
            <DataTable
              columns={[
                { label: 'ID' },
                { label: 'Apply Date' },
                { label: 'Total Loan' },
                { label: 'Paid Amount' },
                { label: 'Due Loan Amount' },
                { label: 'Installment' },
                { label: 'Status' },
              ]}
              isEmpty={detail.length === 0}
              empty="No loans for this staff member."
            >
              {detail.map((row, index) => (
                <Tr key={row.loan.id}>
                  <Td>{index + 1}</Td>
                  <Td>{row.applyDateLabel}</Td>
                  <Td>{row.totalLabel}</Td>
                  <Td>{row.paidLabel}</Td>
                  <Td>{row.dueLabel}</Td>
                  <Td>{row.installmentLabel}</Td>
                  <Td>
                    <Badge color={row.loan.paid === 1 ? 'success' : 'error'} size="sm">
                      {row.loan.paid === 1 ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        ) : null}
      </div>
    </>
  );
}
