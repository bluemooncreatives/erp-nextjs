// Staff profile - port of StaffController@show (`backEnd.staffs.viewStaff`):
// the profile card, the documents tab with its upload form, the leave, payroll
// and loan histories, and the staff account's transactions.
//
// Laravel bound the same controller method to `staffs.view`
// (/hr/staff/view/{id}), which the list links to, and to the resource route
// `staffs.show`; each page authorizes its own permission and renders this.

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@/lib/auth/permissions';
import { findStaff } from '@/lib/hr/staff';
import { leaveBalance, listLeaveApplications, staffPayrolls } from '@/lib/hr/leave';
import { staffLoans } from '@/lib/hr/loans';
import { findContactAccount } from '@/lib/accounting/accounts';
import { accountStatement } from '@/lib/accounting/reports';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { avatarUrl, assetUrl } from '@/lib/paths';
import { ROUTES, route } from '@/lib/routes';
import { Card, DetailList, PageHeader } from '@/components/erp/page';
import { DataTable, StatusBadge, Td, Tr } from '@/components/erp/table';
import { Tabs } from '@/components/erp/tabs';
import { ActionButton } from '@/components/erp/submit-button';
import { removeStaffDocument } from './actions';
import { StaffDocumentUpload } from './staffs/[id]/document-upload';

export async function StaffDetail({ id }: { id: number }) {
  const found = await findStaff(id);
  if (!found) notFound();

  const { staff, user, roleName, departmentName, showroomName, warehouseName } = found;

  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const money = (value: number | string | null | undefined) =>
    `${symbol} ${numberFormat(value)}`;

  const account = await findContactAccount(user.id, MorphType.User);

  const [leaves, balance, payrolls, loans, statement, canEdit] = await Promise.all([
    listLeaveApplications({ userId: user.id, perPage: 50 }),
    leaveBalance(user.id),
    staffPayrolls(staff.id),
    staffLoans(user.id),
    account ? accountStatement(account.id) : Promise.resolve(null),
    can('staffs.edit'),
  ]);

  const leaveRows = await Promise.all(
    leaves.rows.map(async (row) => ({
      id: row.leave.id,
      type: row.leaveTypeName,
      from: await dateConvert(row.leave.startDate),
      to: await dateConvert(row.leave.endDate),
      status: row.leave.status,
      days: row.leave.totalDays,
    })),
  );

  const payrollRows = await Promise.all(
    payrolls.map(async (row) => ({
      id: row.payroll.id,
      month: row.payroll.payrollMonth,
      year: row.payroll.payrollYear,
      net: money(row.payroll.netSalary),
      status: row.payroll.activeStatus,
      dateLabel: await dateConvert(row.payroll.createdAt),
    })),
  );

  const statementRows = statement
    ? await Promise.all(
        statement.rows.map(async (row) => ({
          id: row.id,
          dateLabel: await dateConvert(row.date),
          narration: row.narration,
          debit: row.type === 'Dr' ? money(row.amount) : '',
          credit: row.type === 'Cr' ? money(row.amount) : '',
          balance: money(row.balance),
        })),
      )
    : [];

  const profilePanel = (
    <Card title="Profile">
      <DetailList
        columns={3}
        items={[
          { label: 'Employee ID', value: staff.employeeId ?? '-' },
          { label: 'Name', value: user.name },
          { label: 'Email', value: user.email ?? '-' },
          { label: 'Phone', value: staff.phone ?? '-' },
          { label: 'Role', value: roleName ?? '-' },
          { label: 'Department', value: departmentName ?? '-' },
          { label: 'Branch', value: showroomName ??'-' },
          { label: 'Warehouse', value: warehouseName ??'-' },
          { label: 'Employment Type', value: staff.employmentType ?? '-' },
          { label: 'Date of Joining', value: await dateConvert(staff.dateOfJoining) },
          { label: 'Date of Birth', value: await dateConvert(staff.dateOfBirth) },
          { label: 'Basic Salary', value: money(staff.basicSalary) },
          { label: 'Opening Balance', value: money(staff.openingBalance) },
          { label: 'Current Address', value: staff.currentAddress ?? '-' },
          { label: 'Permanent Address', value: staff.permanentAddress ?? '-' },
          { label: 'Bank Account Name', value: staff.bankAccountName ?? '-' },
          { label: 'Bank Account No', value: staff.bankAccountNo ?? '-' },
          { label: 'Bank Name', value: staff.bankName ?? '-' },
          { label: 'Bank Branch', value: staff.bankBranchName ?? '-' },
        ]}
      />
    </Card>
  );

  const documentsPanel = (
    <div className="space-y-5">
      <Card title="Documents" bodyClassName="">
        <DataTable
          columns={[{ label: 'Document Title'}, { label:'Action' }]}
          isEmpty={found.documents.length === 0}
          empty="No documents uploaded."
        >
          {found.documents.map((doc) => (
            <Tr key={doc.id}>
              <Td>{doc.name ?? `Document ${doc.id}`}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  {doc.documents ? (
                    <a
                      href={assetUrl(doc.documents) ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      View
                    </a>
                  ) : null}
                  {canEdit ? (
                    <form action={removeStaffDocument}>
                      <input type="hidden" name="id" value={doc.id} />
                      <ActionButton confirm="Delete this document?">Delete</ActionButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>

      {canEdit ? <StaffDocumentUpload staffId={staff.id} /> : null}
    </div>
  );

  const leavePanel = (
    <Card
      title="Leave"
      desc={`Entitlement ${balance.entitlement} - taken ${balance.taken} - remaining ${balance.remaining}`}
      bodyClassName=""
    >
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
          <Tr key={row.id}>
            <Td>{row.type ?? '-'}</Td>
            <Td>{row.from || '-'}</Td>
            <Td>{row.to || '-'}</Td>
            <Td>{row.days ?? '-'}</Td>
            <Td>
              <StatusBadge status={row.status === 1} />
            </Td>
          </Tr>
        ))}
      </DataTable>
    </Card>
  );

  const payrollPanel = (
    <Card title="Payroll" bodyClassName="">
      <DataTable
        columns={[
          { label: 'Month' },
          { label: 'Year' },
          { label: 'Net Salary' },
          { label: 'Generated' },
          { label: 'Status' },
        ]}
        isEmpty={payrollRows.length === 0}
        empty="No payroll records."
      >
        {payrollRows.map((row) => (
          <Tr key={row.id}>
            <Td>{row.month ?? '-'}</Td>
            <Td>{row.year ?? '-'}</Td>
            <Td>{row.net}</Td>
            <Td>{row.dateLabel || '-'}</Td>
            <Td>
              <StatusBadge status={row.status === 1} />
            </Td>
          </Tr>
        ))}
      </DataTable>
    </Card>
  );

  const loanPanel = (
    <Card title="Loans" bodyClassName="">
      <DataTable
        columns={[
          { label: 'Title' },
          { label: 'Amount' },
          { label: 'Months' },
          { label: 'Status' },
        ]}
        isEmpty={loans.length === 0}
        empty="No loans."
      >
        {loans.map((row) => (
          <Tr key={row.loan.id}>
            <Td>{row.loan.title ?? '-'}</Td>
            <Td>{money(row.loan.amount)}</Td>
            <Td>{row.loan.totalMonth ?? '-'}</Td>
            <Td>
              <StatusBadge status={row.loan.approval === 1} />
            </Td>
          </Tr>
        ))}
      </DataTable>
    </Card>
  );

  const transactionPanel = (
    <Card title="Transactions" bodyClassName="">
      <DataTable
        columns={[
          { label: 'Date' },
          { label: 'Description' },
          { label: 'Debit' },
          { label: 'Credit' },
          { label: 'Balance' },
        ]}
        isEmpty={statementRows.length === 0}
        empty="No transactions."
      >
        {statementRows.map((row) => (
          <Tr key={row.id}>
            <Td>{row.dateLabel || '-'}</Td>
            <Td>{row.narration ?? '-'}</Td>
            <Td>{row.debit}</Td>
            <Td>{row.credit}</Td>
            <Td>{row.balance}</Td>
          </Tr>
        ))}
      </DataTable>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={user.name}
        breadcrumb={[
          { label: 'Staff', href: ROUTES['staffs.index'] },
          { label: user.name },
        ]}
        actions={
          canEdit ? (
            <Link
              href={route('staffs.edit', { id: staff.id })}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
            >
              Edit
            </Link>
          ) : null
        }
      />

      <div className="space-y-5">
        <Card title={staff.employeeId ?? 'Staff'}>
          <div className="flex flex-wrap items-center gap-6">
            <Image
              src={avatarUrl(user.avatar, user.name)}
              alt={user.name}
              width={72}
              height={72}
              className="rounded-full object-cover"
              unoptimized
            />
            <div>
              <p className="text-lg font-medium text-foreground">
                {user.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {roleName ?? '-'} &middot; {departmentName ?? '-'}
              </p>
            </div>
          </div>
        </Card>

        <Tabs
          orientation="horizontal"
          tabs={[
            { id: 'profile', label: 'Profile', content: profilePanel },
            { id: 'documents', label:'Documents', content: documentsPanel },
            { id: 'leave', label: 'Leave', content: leavePanel },
            { id: 'payroll', label: 'Payroll', content: payrollPanel },
            { id: 'loans', label:'Loans', content: loanPanel },
            { id: 'transactions', label:'Transactions', content: transactionPanel },
          ]}
        />
      </div>
    </>
  );
}
