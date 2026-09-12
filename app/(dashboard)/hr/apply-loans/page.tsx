// Staff loans - port of Modules/Setup ApplyLoanController@index
// (`setup::staff_loans.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { listMyLoans, LoanApproval, approvalBadge } from '@/lib/hr/loans';
import { singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { destroyLoan } from './actions';

export const metadata: Metadata = { title: 'Apply For Loan' };

export default async function ApplyLoansPage() {
  const user = await requireUser();
  const loans = await listMyLoans(user.id);

  const rows = await Promise.all(
    loans.map(async (row) => ({
      ...row,
      amountLabel: await singlePrice(row.loan.amount),
      installmentLabel: await singlePrice(row.loan.monthlyInstallment),
      dueLabel: await singlePrice(row.loan.amount - row.loan.paidLoanAmount),
    })),
  );

  return (
    <>
      <PageHeader
        title="Apply For Loan"
        breadcrumb={[{ label: 'HR' }, { label: 'Apply For Loan' }]}
        actions={
          <Link
            href={ROUTES['apply_loans.create']}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            Apply For Loan
          </Link>
        }
      />

      <Card title={`Loans (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'User' },
            { label: 'Type' },
            { label: 'Amount' },
            { label: 'Monthly Installment' },
            { label: 'Due' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={rows.length === 0}
          empty="No loans applied for."
        >
          {rows.map((row, index) => {
            const badge = approvalBadge(row.loan.approval);
            return (
              <Tr key={row.loan.id}>
                <Td>{index + 1}</Td>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {row.userName ?? 'Removed'}
                </Td>
                <Td>{row.loan.loanType}</Td>
                <Td>{row.amountLabel}</Td>
                <Td>{row.installmentLabel}</Td>
                <Td>{row.dueLabel}</Td>
                <Td>
                  <Badge color={badge.color} size="sm">
                    {badge.label}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {/* Approved loans were locked in the Blade. */}
                    {row.loan.approval !== LoanApproval.Approved ? (
                      <>
                        <Link
                          href={`${ROUTES['apply_loans.create']}?id=${row.loan.id}`}
                          className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                        >
                          Edit
                        </Link>
                        <form action={destroyLoan}>
                          <input type="hidden" name="id" value={row.loan.id} />
                          <ActionButton confirm="Delete this loan?">Delete</ActionButton>
                        </form>
                      </>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </Card>
    </>
  );
}
