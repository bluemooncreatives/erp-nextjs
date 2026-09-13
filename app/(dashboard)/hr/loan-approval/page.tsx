// Loan approval - port of ApplyLoanController@loan_approval_index
// (`setup::approval_loans.index`).

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listAllLoans, LoanApproval, approvalBadge } from '@/lib/hr/loans';
import { singlePrice, dateConvert } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { ReportSummary } from '@/components/erp/report-summary';
import { BadgeCheck, Clock, HandCoins, Wallet } from 'lucide-react';
import { destroyLoan, setLoanApproval } from '../apply-loans/actions';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Loan Approval' };

export default async function LoanApprovalPage() {
  await authorize('apply_loans.loan_approval_index');

  const loans = await listAllLoans();
  const canApprove = await can('set_approval_applied_loan');

  const rows = await Promise.all(
    loans.map(async (row) => ({
      ...row,
      amountLabel: await singlePrice(row.loan.amount),
      installmentLabel: await singlePrice(row.loan.monthlyInstallment),
      dueLabel: await singlePrice(row.loan.amount - row.loan.paidLoanAmount),
      loanDateLabel: await dateConvert(row.loan.loanDate),
    })),
  );

  const approvedCount = loans.filter((row) => row.loan.approval === LoanApproval.Approved).length;
  const pendingCount = loans.filter((row) => row.loan.approval === LoanApproval.Pending).length;
  // Only approved loans represent money actually lent out.
  const outstandingLabel = await singlePrice(
    loans
      .filter((row) => row.loan.approval === LoanApproval.Approved)
      .reduce(
        (sum, row) => sum + (Number(row.loan.amount ?? 0) - Number(row.loan.paidLoanAmount ?? 0)),
        0,
      ),
  );

  return (
    <>
      <PageHeader
        title="Loan Approval"
        breadcrumb={[{ label: 'HR' }, { label: 'Loan Approval' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Applications', value: rows.length, detail: 'Across every member of staff', icon: HandCoins },
          { label: 'Pending', value: pendingCount, detail: 'Waiting on your decision', icon: Clock },
          { label: 'Approved', value: approvedCount, detail: 'Already granted', icon: BadgeCheck },
          { label: 'Outstanding', value: outstandingLabel, detail: 'Still to be repaid', icon: Wallet },
        ]}
      />

      <Card title="Applied loans" bodyClassName="">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'Name' },
            { label: 'Department' },
            { label: 'Type' },
            { label: 'Loan Date' },
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
                <Td>{row.departmentName ?? '-'}</Td>
                <Td>{row.loan.loanType}</Td>
                <Td>{row.loanDateLabel}</Td>
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
                    {canApprove && row.loan.approval !== LoanApproval.Approved ? (
                      <form action={setLoanApproval}>
                        <input type="hidden" name="id" value={row.loan.id} />
                        <input type="hidden" name="approval" value={LoanApproval.Approved} />
                        <ActionButton variant="primary" confirm="Approve this loan?">
                          <Phrase>Approve</Phrase>
                        </ActionButton>
                      </form>
                    ) : null}
                    {canApprove && row.loan.approval === LoanApproval.Pending ? (
                      <form action={setLoanApproval}>
                        <input type="hidden" name="id" value={row.loan.id} />
                        <input type="hidden" name="approval" value={LoanApproval.Rejected} />
                        <ActionButton confirm="Cancel this loan?"><Phrase>Cancel</Phrase></ActionButton>
                      </form>
                    ) : null}
                    {row.loan.approval !== LoanApproval.Approved ? (
                      <form action={destroyLoan}>
                        <input type="hidden" name="id" value={row.loan.id} />
                        <ActionButton confirm="Delete this loan?"><Phrase>Delete</Phrase></ActionButton>
                      </form>
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
