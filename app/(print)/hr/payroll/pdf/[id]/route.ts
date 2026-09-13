// `payroll.pdf` - PayrollController@getPdf, rendered through
// `PdfGenerate::getPayroll()`. dompdf produced a file here; this now does
// too, from the same data the payslip screen shows on screen.

import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findPayroll, isEarningLine } from '@/lib/hr/leave';
import { formatPrice, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import type { Content } from '@/lib/pdf/build';
import { RULED_TABLE, companyHeader, pdfResponse } from '@/lib/pdf/build';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const found = await findPayroll(Number(id));
  if (!found) notFound();

  const { payroll, staffName, employeeId, departmentName, preparedByName, lines } = found;
  const setting = await generalSetting();
  const money = (value: number | null | undefined) =>
    formatPrice(Number(value ?? 0), setting.currencySymbol);

  const earnings = lines.filter((line) => isEarningLine(line.earnDedcType));
  const deductions = lines.filter((line) => !isEarningLine(line.earnDedcType));

  const amountTable = (title: string, rows: Array<[string, string]>, total: [string, string]): Content => ({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: title, style: 'tableHeader' },
          { text: 'Amount', style: 'tableHeader', alignment: 'right' },
        ],
        ...rows.map(([label, value]) => [label, { text: value, alignment: 'right' }] as Content[]),
        [
          { text: total[0], bold: true },
          { text: total[1], bold: true, alignment: 'right' },
        ],
      ],
    },
    layout: RULED_TABLE,
  });

  const content: Content[] = [
    companyHeader({
      name: setting.companyName ?? null,
      phone: setting.phone ?? null,
      email: setting.email ?? null,
      address: setting.address ?? null,
      logoUrl: assetUrl(setting.logo),
    }),
    { text: 'Payslip Details', style: 'h2', margin: [0, 0, 0, 10] },
    {
      columns: [
        {
          width: '*',
          stack: [{ text: `Prepared by: ${preparedByName ?? '-'}` }],
        },
        {
          width: '*',
          stack: [
            { text: `Staff ID: ${employeeId ?? '-'}` },
            { text: `Name: ${staffName ?? '-'}` },
            { text: `Department: ${departmentName ?? '-'}` },
            { text: `Payment Method: ${(payroll.paymentMode ?? '').toUpperCase() || '-'}` },
            { text: `Month: ${`${payroll.payrollMonth ?? ''} ${payroll.payrollYear ?? ''}`.trim() || '-'}` },
          ],
        },
      ],
      margin: [0, 0, 0, 18],
      columnGap: 24,
    },
    {
      columns: [
        amountTable(
          'Earning',
          [
            ['Basic Salary', money(payroll.basicSalary)],
            ...earnings.map((line): [string, string] => [line.typeName ?? '-', money(line.amount)]),
          ],
          ['Total Earning', money(payroll.totalEarning)],
        ),
        amountTable(
          'Deduction',
          deductions.length
            ? deductions.map((line): [string, string] => [line.typeName ?? '-', money(line.amount)])
            : [['No deductions', money(0)]],
          ['Total Deduction', money(payroll.totalDeduction)],
        ),
      ],
      columnGap: 16,
      margin: [0, 0, 0, 18],
    },
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 230,
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Gross Salary', { text: money(payroll.grossSalary), alignment: 'right' }],
              ['Tax', { text: money(payroll.tax), alignment: 'right' }],
              [
                { text: 'Net Salary', bold: true },
                { text: money(payroll.netSalary), bold: true, alignment: 'right' },
              ],
            ] as Content[][],
          },
          layout: 'noBorders',
        },
      ],
    },
  ];

  return pdfResponse(
    { content },
    `Payslip-${employeeId ?? payroll.id}-${payroll.payrollMonth}-${payroll.payrollYear}.pdf`,
  );
}
