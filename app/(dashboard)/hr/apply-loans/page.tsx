import { LinkButton } from '@/components/common/link-button';
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
import { ReportSummary } from '@/components/erp/report-summary';
import { BadgeCheck, Clock, HandCoins, Wallet } from 'lucide-react';
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

  const approvedCount = loans.filter((row) => row.loan.approval === LoanApproval.Approved).length;
  const pendingCount = loans.filter((row) => row.loan.approval === LoanApproval.Pending).length;
  const borrowedLabel = await singlePrice(
    loans.reduce((sum, row) => sum + Number(row.loan.amount ?? 0), 0),
  );
  // What is still owed, not what was borrowed - the figure a borrower checks.
  const outstandingLabel = await singlePrice(
    loans.reduce(
      (sum, row) => sum + (Number(row.loan.amount ?? 0) - Number(row.loan.paidLoanAmount ?? 0)),
      0,
    ),
  );

  return (
    <>
      <PageHeader
        title="Apply For Loan"
        breadcrumb={[{ label: 'HR' }, { label: 'Apply For Loan' }]}
        actions={
          <LinkButton
            href={ROUTES['apply_loans.create']}
            
          >
            Apply For Loan
          </LinkButton>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Applications', value: rows.length, detail: 'You have submitted', icon: HandCoins },
          { label: 'Approved', value: approvedCount, detail: 'Granted to you', icon: BadgeCheck },
          { label: 'Pending', value: pendingCount, detail: 'Awaiting a decision', icon: Clock },
          { label: 'Still owed', value: outstandingLabel, detail: `Of ${borrowedLabel} borrowed`, icon: Wallet },
        ]}
      />

      <Card title="Your loans" bodyClassName="">
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
                <Td className="font-medium text-foreground">
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
                          className="text-xs font-medium text-primary hover:text-primary"
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
