'use client';

// ---------------------------------------------------------------------------
// Shared voucher form for Expense, Income and Journal entry.
//
// One "main" account (the cash/bank account being paid from, the account being
// received into, or the journal's main account) against one or more sub lines.
// The amount is the sum of the lines, which is how the PHP derived it.
// ---------------------------------------------------------------------------

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import type { AccountFormState } from './actions';

const INITIAL: AccountFormState = {};

type Line = { key: number; accountId: string; amount: number; narration: string };

export function VoucherForm({
  action,
  heading,
  mainAccountLabel,
  mainAccounts,
  lineAccountLabel,
  lineAccounts,
  currencySymbol,
  cancelHref,
  submitLabel,
  showPaymentMethod = true,
  showAccountTypeToggle = false,
  defaults,
}: {
  action: (prev: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  heading: string;
  mainAccountLabel: string;
  mainAccounts: SelectOption[];
  lineAccountLabel: string;
  lineAccounts: SelectOption[];
  currencySymbol: string;
  cancelHref: string;
  submitLabel: string;
  showPaymentMethod?: boolean;
  /** Journal entry lets the user choose which side the main account sits on. */
  showAccountTypeToggle?: boolean;
  defaults?: {
    id?: number;
    accountId?: number | null;
    accountType?: 'debit' | 'credit';
    date?: string | null;
    narration?: string | null;
    lines?: Array<{ accountId: number; amount: number; narration: string | null }>;
  };
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [method, setMethod] = useState('cash');
  const [lines, setLines] = useState<Line[]>(
    defaults?.lines?.length
      ? defaults.lines.map((l, i) => ({
          key: i,
          accountId: String(l.accountId),
          amount: l.amount,
          narration: l.narration ?? '',
        }))
      : [{ key: 0, accountId: '', amount: 0, narration: '' }],
  );

  const total = lines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const patch = (key: number, value: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...value } : l)));

  return (
    <form action={formAction} className="space-y-6">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="main_amount" value={total} />
      <input type="hidden" name="sub_amounts" value={total} />

      <FormAlert variant="error" message={state.error} />

      <Card title={heading}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label={mainAccountLabel}
            name="account_id"
            required
            placeholder="Select account"
            defaultValue={defaults?.accountId != null ? String(defaults.accountId) : ''}
            options={mainAccounts}
            error={state.fieldErrors?.account_id}
          />

          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />

          {showPaymentMethod ? (
            <FormSelect
              label="Payment Method"
              name="payment_method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label:'Bank' },
              ]}
            />
          ) : null}

          {showAccountTypeToggle ? (
            <FormSelect
              label="Main account side"
              name="account_type"
              defaultValue={defaults?.accountType ?? 'debit'}
              error={state.fieldErrors?.account_type}
              options={[
                { value: 'debit', label: 'Debit' },
                { value: 'credit', label: 'Credit' },
              ]}
            />
          ) : null}
        </div>

        {showPaymentMethod && method === 'bank' ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <FormInput label="Bank Name" name="bank_name" />
            <FormInput label="Bank Branch" name="bank_branch" />
            <FormInput label="Cheque No" name="cheque_no" />
            <FormInput label="Cheque Date" name="cheque_date" type="date" />
          </div>
        ) : null}
      </Card>

      <Card title="Lines" bodyClassName="">
        <FormAlert variant="error" message={state.fieldErrors?.sub_amount ?? state.fieldErrors?.main_amount} />
        {state.fieldErrors?.sub_account_id ? (
          <p className="px-4 pt-4 text-xs text-destructive sm:px-6">
            {state.fieldErrors.sub_account_id}
          </p>
        ) : null}

        <DataTable
          columns={[
            { label: lineAccountLabel },
            { label: 'Amount' },
            { label: 'Narration' },
            { label: '' },
          ]}
          isEmpty={false}
        >
          {lines.map((line) => (
            <Tr key={line.key}>
              <Td>
                <select
                  name="sub_account_id"
                  required
                  value={line.accountId}
                  onChange={(e) => patch(line.key, { accountId: e.target.value })}
                  className="h-9 w-64 rounded-lg border border-border bg-transparent px-2 text-sm"
                >
                  <option value="">Select account</option>
                  {lineAccounts.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="sub_amount"
                  value={line.amount}
                  onChange={(e) => patch(line.key, { amount: Number(e.target.value) })}
                  className="h-9 w-32 rounded-lg border border-border bg-transparent px-2 text-sm"
                />
              </Td>
              <Td>
                <input
                  type="text"
                  name="sub_narration"
                  value={line.narration}
                  onChange={(e) => patch(line.key, { narration: e.target.value })}
                  className="h-9 w-64 rounded-lg border border-border bg-transparent px-2 text-sm"
                />
              </Td>
              <Td>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                    className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </button>
                ) : null}
              </Td>
            </Tr>
          ))}
        </DataTable>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { key: Date.now(), accountId: '', amount: 0, narration: '' },
              ])
            }
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-primary ring-1 ring-inset ring-ring/50 hover:bg-primary/10"
          >
            Add line
          </button>

          <p className="text-base font-semibold text-foreground">
            Total: {currencySymbol} {total.toFixed(2)}
          </p>
        </div>
      </Card>

      <Card title="Narration">
        <FormTextarea
          label="Narration"
          name="narration"
          defaultValue={defaults?.narration ?? ''}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={cancelHref}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted"
        >
          Cancel
        </Link>
        <SubmitButton disabled={total <= 0}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
