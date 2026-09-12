// Apply for loan - port of ApplyLoanController@create / @edit
// (`setup::staff_loans.create` and `.edit`, which were modals).

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { findLoan, loanApplicants } from '@/lib/hr/loans';
import { departmentRepository } from '@/lib/product/repositories';
import { PageHeader, Card } from '@/components/erp/page';
import { LoanForm } from '../loan-form';

export const metadata: Metadata = { title: 'Apply For Loan' };

export default async function ApplyLoanCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const [loan, departments, users] = await Promise.all([
    sp.id ? findLoan(Number(sp.id)) : Promise.resolve(null),
    departmentRepository.all(),
    loanApplicants(user.id),
  ]);

  return (
    <>
      <PageHeader
        title={loan ? 'Edit Loan' : 'Apply For Loan'}
        breadcrumb={[{ label: 'HR' }, { label: 'Apply For Loan' }]}
      />

      <Card title={loan ? 'Edit Loan' : 'Apply For Loan'}>
        <LoanForm
          loan={
            loan
              ? {
                  id: loan.loan.id,
                  userId: loan.loan.userId,
                  departmentId: loan.loan.departmentId,
                  title: loan.loan.title ?? '',
                  loanType: loan.loan.loanType ?? 'General',
                  loanDate: loan.loan.loanDate ?? '',
                  amount: loan.loan.amount,
                  totalMonth: loan.loan.totalMonth ?? 0,
                  monthlyInstallment: loan.loan.monthlyInstallment,
                  note: loan.loan.note ?? '',
                }
              : null
          }
          departments={departments
            .filter((d) => d.status === 1)
            .map((d) => ({ value: d.id, label: d.name ?? '' }))}
          users={users.map((u) => ({ value: u.id, label: u.name }))}
          currentUserId={user.id}
          isSystemUser={user.role.type === 'system_user'}
        />
      </Card>
    </>
  );
}
