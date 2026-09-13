// `payroll_earn_deducs.earn_dedc_type`.
//
// The migration describes the column as "e for earnings and d for deductions",
// and `PayrollRepository` writes the single letters 'E' and 'D'. The payroll
// reports read it back with `where('earn_dedc_type', 'E')`, so a row holding
// anything else is invisible to them.
//
// This is deliberately not server-only: the Generate Payroll form previews the
// totals in the browser and has to split the lines the same way the action does.

export const PayrollLineKind = { Earning: 'E', Deduction: 'D' } as const;

/** True for an earnings line, tolerating the longer spellings a form may post. */
export function isEarningLine(kind: string | null | undefined): boolean {
  return (kind ?? '').trim().toUpperCase().startsWith('E');
}
