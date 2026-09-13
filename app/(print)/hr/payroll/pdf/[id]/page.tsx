// `payroll.pdf` - PayrollController@getPdf, which renders
// `payroll::payrolls.viewPayslip` through `PdfGenerate::getPayroll()`.
//
// dompdf has no equivalent here, so this is the payslip itself on a print
// sheet; "Save as PDF" from the browser produces the same document. The same
// view is what `payroll_view_slip_modal` showed inline.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findPayroll, isEarningLine } from '@/lib/hr/leave';
import { formatPrice, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'Payslip Details' };

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const found = await findPayroll(Number(id));
  if (!found) notFound();

  const { payroll, staffName, employeeId, departmentName, preparedByName, lines } = found;
  const setting = await generalSetting();
  const money = (value: number | null | undefined) =>
    formatPrice(Number(value ?? 0), setting.currencySymbol);
  const logo = assetUrl(setting.logo);

  // `payrollEarnDetails` / `payrollDedcDetails` - the same rows split by type.
  const earnings = lines.filter((line) => isEarningLine(line.earnDedcType));
  const deductions = lines.filter((line) => !isEarningLine(line.earnDedcType));

  return (
    <>
      <div className="mb-6 flex items-start justify-between border-b pb-5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-16 w-auto" />
        ) : (
          <span className="text-lg font-semibold">{setting.companyName}</span>
        )}
        <PrintButton />
      </div>

      <h1 className="mb-6 text-xl font-semibold">Payslip Details</h1>

      <div className="mb-8 grid gap-8 sm:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="font-semibold">Company</dt>
          <dd>{setting.companyName ?? '-'}</dd>
          <dt className="font-semibold">Phone</dt>
          <dd>{setting.phone ?? '-'}</dd>
          <dt className="font-semibold">Email</dt>
          <dd>{setting.email ?? '-'}</dd>
          <dt className="font-semibold">Address</dt>
          <dd>{setting.address ?? '-'}</dd>
          <dt className="font-semibold">Prepared By</dt>
          <dd>{preparedByName ?? '-'}</dd>
        </dl>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="font-semibold">Staff ID</dt>
          <dd>{employeeId ?? '-'}</dd>
          <dt className="font-semibold">Name</dt>
          <dd>{staffName ?? '-'}</dd>
          <dt className="font-semibold">Department</dt>
          <dd>{departmentName ?? '-'}</dd>
          <dt className="font-semibold">Payment Method</dt>
          <dd>{(payroll.paymentMode ?? '').toUpperCase() || '-'}</dd>
          <dt className="font-semibold">Month</dt>
          <dd>{`${payroll.payrollMonth ?? ''} ${payroll.payrollYear ?? ''}`.trim() || '-'}</dd>
        </dl>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <DataTable
          columns={[{ label: 'Earning' }, { label: 'Amount', align: 'right' }]}
          isEmpty={false}
        >
          <Tr>
            <Td>Basic Salary</Td>
            <Td className="text-right">{money(payroll.basicSalary)}</Td>
          </Tr>
          {earnings.map((line) => (
            <Tr key={line.id}>
              <Td>{line.typeName ?? '-'}</Td>
              <Td className="text-right">{money(line.amount)}</Td>
            </Tr>
          ))}
          <Tr>
            <Td className="font-semibold">Total Earning</Td>
            <Td className="text-right font-semibold">{money(payroll.totalEarning)}</Td>
          </Tr>
        </DataTable>

        <DataTable
          columns={[{ label: 'Deduction' }, { label: 'Amount', align: 'right' }]}
          isEmpty={false}
        >
          {deductions.length === 0 ? (
            <Tr>
              <Td>No deductions</Td>
              <Td className="text-right">{money(0)}</Td>
            </Tr>
          ) : (
            deductions.map((line) => (
              <Tr key={line.id}>
                <Td>{line.typeName ?? '-'}</Td>
                <Td className="text-right">{money(line.amount)}</Td>
              </Tr>
            ))
          )}
          <Tr>
            <Td className="font-semibold">Total Deduction</Td>
            <Td className="text-right font-semibold">{money(payroll.totalDeduction)}</Td>
          </Tr>
        </DataTable>
      </div>

      <dl className="mt-8 grid grid-cols-[auto_1fr] justify-end gap-x-6 gap-y-1 text-sm sm:ml-auto sm:w-72">
        <dt className="font-semibold">Gross Salary</dt>
        <dd className="text-right">{money(payroll.grossSalary)}</dd>
        <dt className="font-semibold">Tax</dt>
        <dd className="text-right">{money(payroll.tax)}</dd>
        <dt className="text-base font-semibold">Net Salary</dt>
        <dd className="text-right text-base font-semibold">{money(payroll.netSalary)}</dd>
      </dl>
    </>
  );
}
