'use client';

import { LinkButton } from '@/components/common/link-button';
// Payment voucher form - port of `account::voucher.create`.
//
// One paying account (credited) against one or more accounts being settled
// (debited), which is the shape `VoucherRepository::create()` expects.

import { useActionState, useState } from 'react';
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
import { ROUTES } from '@/lib/routes';
import { storeVoucher, updatePaymentVoucher, type AccountFormState } from '../../actions';
import { SelectControl } from '@/components/erp/select-control';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: AccountFormState = {};

type Line = { key: number; accountId: string; amount: number; narration: string };

export type PaymentVoucherDefaults = {
  id: number;
  voucherType: string;
  date: string;
  creditAccountId: number;
  lines: Omit<Line, 'key'>[];
  narration?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  chequeNo?: string | null;
  chequeDate?: string | null;
};

export function PaymentVoucherForm({
  payAccounts,
  allAccounts,
  currencySymbol,
  paymentType,
  heading,
  defaults,
}: {
  payAccounts: SelectOption[];
  allAccounts: SelectOption[];
  currencySymbol: string;
  paymentType: 'voucher_payment';
  heading: string;
  defaults?: PaymentVoucherDefaults;
}) {
  const [state, formAction] = useActionState(defaults ? updatePaymentVoucher : storeVoucher, INITIAL);
  const [voucherType, setVoucherType] = useState(defaults?.voucherType ?? 'CV');
  const [lines, setLines] = useState<Line[]>(defaults?.lines.map((line, key) => ({ ...line, key })) ?? [
    { key: 0, accountId: '', amount: 0, narration: '' },
  ]);

  const total = lines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const patch = (key: number, value: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...value } : l)));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payment_type" value={paymentType} />
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormAlert variant="error" message={state.error} />

      <Card title={heading}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Voucher Type"
            name="voucher_type"
            error={state.fieldErrors?.voucher_type}
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
            options={[
              { value: 'CV', label: 'Cash Voucher' },
              { value: 'BV', label: 'Bank Voucher' },
            ]}
          />
          <FormSelect
            label="Paid from"
            name="credit_account_id"
            required
            placeholder="Select account"
            options={payAccounts}
            defaultValue={defaults?.creditAccountId}
            error={state.fieldErrors?.credit_account_id}
          />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />
        </div>

        {voucherType === 'BV' ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <FormInput label="Bank Name" name="bank_name" defaultValue={defaults?.bankName ?? ''} />
            <FormInput label="Bank Branch" name="bank_branch" defaultValue={defaults?.bankBranch ?? ''} />
            <FormInput label="Cheque No" name="cheque_no" defaultValue={defaults?.chequeNo ?? ''} />
            <FormInput label="Cheque Date" name="cheque_date" type="date" defaultValue={defaults?.chequeDate ?? ''} />
          </div>
        ) : null}
      </Card>

      <Card title="Lines" bodyClassName="">
        <FormAlert variant="error" message={state.fieldErrors?.debit_account_amount} />
        {state.fieldErrors?.debit_account_id ? (
          <p className="px-4 pt-4 text-xs text-destructive sm:px-6">
            {state.fieldErrors.debit_account_id}
          </p>
        ) : null}

        <DataTable
          columns={[
            { label: 'Account' },
            { label: 'Amount' },
            { label: 'Narration' },
            { label: '' },
          ]}
          isEmpty={false}
        >
          {lines.map((line) => (
            <Tr key={line.key}>
              <Td>
                <SelectControl
                  name="debit_account_id"
                  required
                  value={line.accountId}
                  onChange={(e) => patch(line.key, { accountId: e.target.value })}
                  options={allAccounts}
                  placeholder="Select account"
                  aria-label="Account"
                  className="w-64"
                />
              </Td>
              <Td>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="debit_account_amount"
                  value={line.amount}
                  onChange={(e) => patch(line.key, { amount: Number(e.target.value) })}
                  className="h-9 w-32 rounded-lg border border-border bg-transparent px-2 text-sm"
                />
              </Td>
              <Td>
                <input
                  type="text"
                  name="debit_account_narration"
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
                    <Phrase>Remove</Phrase>
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
        <FormTextarea label="Narration" name="narration" defaultValue={defaults?.narration ?? ''} />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <LinkButton
          href={ROUTES['vouchers.index']}
          variant="outline"
        >
          <Phrase>Cancel</Phrase>
        </LinkButton>
        <SubmitButton disabled={total <= 0}>{defaults ? 'Update Voucher' : 'Save Voucher'}</SubmitButton>
      </div>
    </form>
  );
}
