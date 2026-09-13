// Profile - port of StaffController@profile_view (`backEnd.profiles.profile`),
// which pulled the staff record together with leave, payroll, documents and
// loan history, and offered the edit form in a modal.

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { findStaff } from '@/lib/hr/staff';
import { listLeaveApplications, leaveBalance, staffPayrolls } from '@/lib/hr/leave';
import { staffLoans, approvalBadge } from '@/lib/hr/loans';
import { dateConvert, singlePrice } from '@/lib/settings';
import { assetUrl, avatarUrl } from '@/lib/paths';
import { PageHeader, Card, DetailList } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { EditProfileForm } from '../profile-forms';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfileViewPage() {
  const user = await requireUser();
  const staff = user.staff ? await findStaff(user.staff.id) : null;

  const [leaves, balance, payrollRows, loans] = await Promise.all([
    listLeaveApplications({ userId: user.id, perPage: 50 }),
    leaveBalance(user.id),
    user.staff ? staffPayrolls(user.staff.id) : Promise.resolve([]),
    staffLoans(user.id),
  ]);

  const leaveRows = await Promise.all(
    leaves.rows.map(async (row) => ({
      ...row,
      startLabel: await dateConvert(row.leave.startDate),
      endLabel: await dateConvert(row.leave.endDate),
    })),
  );

  const payrolls = await Promise.all(
    payrollRows.map(async (row) => ({
      ...row,
      netLabel: await singlePrice(row.payroll.netSalary),
      basicLabel: await singlePrice(row.payroll.basicSalary),
    })),
  );

  const loanRows = await Promise.all(
    loans.map(async (row) => ({
      ...row,
      amountLabel: await singlePrice(row.loan.amount),
      dueLabel: await singlePrice(row.loan.amount - row.loan.paidLoanAmount),
    })),
  );

  return (
    <>
      <PageHeader title="Profile" breadcrumb={[{ label: 'Profile' }]} />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Card title="Profile">
            <div className="flex flex-col items-center gap-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl(user.avatar, user.name)}
                alt={user.name}
                className="h-24 w-24 rounded-full object-cover"
              />
              <div>
                <p className="text-base font-medium text-foreground">
                  {user.name}
                </p>
                <p className="text-sm text-muted-foreground">{user.role.name}</p>
              </div>
            </div>

            <div className="mt-6">
              <DetailList
                items={[
                  { label: 'Email', value: user.email ?? '-' },
                  { label: 'Phone', value: staff?.staff.phone ?? '-' },
                  { label: 'Employee ID', value: staff?.staff.employeeId ?? '-' },
                  { label: 'Department', value: staff?.departmentName ?? '-' },
                  { label: 'Showroom', value: staff?.showroomName ?? '-' },
                  { label: 'Warehouse', value: staff?.warehouseName ?? '-' },
                  {
                    label: 'Date of Joining',
                    value: await dateConvert(staff?.staff.dateOfJoining),
                  },
                ]}
              />
            </div>
          </Card>

          <Card title="Leave Balance">
            <DetailList
              items={[
                { label: 'Entitlement', value: String(balance.entitlement) },
                { label: 'Taken', value: String(balance.taken) },
                { label: 'Remaining', value: String(balance.remaining) },
              ]}
            />
          </Card>

          <Card title="Documents" bodyClassName="">
            <DataTable
              columns={[{ label: 'Name' }, { label: 'File' }]}
              isEmpty={!staff || staff.documents.length === 0}
              empty="No documents uploaded."
            >
              {(staff?.documents ?? []).map((document) => (
                <Tr key={document.id}>
                  <Td>{document.name ?? '-'}</Td>
                  <Td>
                    {document.documents ? (
                      <a
                        href={assetUrl(document.documents) ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:text-primary"
                      >
                        <Phrase>Download</Phrase>
                      </a>
                    ) : (
                      '-'
                    )}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Edit Profile">
            <EditProfileForm
              profile={{
                name: user.name,
                email: user.email ?? '',
                phone: staff?.staff.phone ?? '',
                bankName: staff?.staff.bankName ?? '',
                bankBranchName: staff?.staff.bankBranchName ?? '',
                bankAccountName: staff?.staff.bankAccountName ?? '',
                bankAccountNo: staff?.staff.bankAccountNo ?? '',
                currentAddress: staff?.staff.currentAddress ?? '',
                permanentAddress: staff?.staff.permanentAddress ?? '',
              }}
              showBankFields={user.roleId !== 1}
            />
          </Card>

          <Card title={`Leave History (${leaveRows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Type' },
                { label: 'From' },
                { label: 'To' },
                { label: 'Days' },
                { label: 'Status' },
              ]}
              isEmpty={leaveRows.length === 0}
              empty="No leave applications."
            >
              {leaveRows.map((row) => (
                <Tr key={row.leave.id}>
                  <Td>{row.leaveTypeName ?? '-'}</Td>
                  <Td>{row.startLabel}</Td>
                  <Td>{row.endLabel}</Td>
                  <Td>{row.leave.totalDays}</Td>
                  <Td>
                    <Badge
                      color={
                        row.leave.status === 1
                          ? 'success'
                          : row.leave.status === 2
                            ? 'error'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {row.leave.status === 1
                        ? 'Approved'
                        : row.leave.status === 2
                          ? 'Rejected'
                          : 'Pending'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          <Card title={`Payroll (${payrolls.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Month' },
                { label: 'Year' },
                { label: 'Basic' },
                { label: 'Net Salary' },
                { label: 'Status' },
              ]}
              isEmpty={payrolls.length === 0}
              empty="No payroll records."
            >
              {payrolls.map((row) => (
                <Tr key={row.payroll.id}>
                  <Td>{row.payroll.payrollMonth}</Td>
                  <Td>{row.payroll.payrollYear}</Td>
                  <Td>{row.basicLabel}</Td>
                  <Td>{row.netLabel}</Td>
                  <Td>
                    <Badge
                      color={row.payroll.payrollStatus === 'Paid' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {row.payroll.payrollStatus ?? 'Generated'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          <Card title={`Loans (${loanRows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Title' },
                { label: 'Type' },
                { label: 'Amount' },
                { label: 'Due' },
                { label: 'Status' },
              ]}
              isEmpty={loanRows.length === 0}
              empty="No loans."
            >
              {loanRows.map((row) => {
                const badge = approvalBadge(row.loan.approval);
                return (
                  <Tr key={row.loan.id}>
                    <Td>{row.loan.title ?? '-'}</Td>
                    <Td>{row.loan.loanType ?? '-'}</Td>
                    <Td>{row.amountLabel}</Td>
                    <Td>{row.dueLabel}</Td>
                    <Td>
                      <Badge color={badge.color} size="sm">
                        {badge.label}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
          </Card>
        </div>
      </div>
    </>
  );
}
