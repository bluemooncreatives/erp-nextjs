'use client';

// `account::opening_balances.create` and `.edit`, plus the close-period form.

import { useActionState, useState } from 'react';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormActions,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import {
  storeOpeningBalance,
  updateOpeningBalances,
  type OpeningBalanceFormState,
} from './actions';

const EMPTY: OpeningBalanceFormState = {};

export function OpeningBalanceForm({ accounts }: { accounts: SelectOption[] }) {
  const [state, action] = useActionState(storeOpeningBalance, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          label="Account"
          name="account_id"
          options={accounts}
          placeholder="Select account"
          required
          error={state.fieldErrors?.account_id}
        />
        <FormSelect
          label="Type"
          name="type"
          defaultValue="asset"
          options={[
            { value: 'asset', label: 'Asset' },
            { value: 'liability', label: 'Liability' },
          ]}
          required
          error={state.fieldErrors?.type}
        />
        <FormInput
          label="Amount"
          name="amount"
          type="number"
          step="0.01"
          min={0}
          required
          error={state.fieldErrors?.amount}
        />
        <FormInput
          label="Date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

type Line = { key: number; accountId: string; amount: number };

function LineTable({
  title,
  accountField,
  amountField,
  accounts,
  lines,
  setLines,
}: {
  title: string;
  accountField: string;
  amountField: string;
  accounts: SelectOption[];
  lines: Line[];
  setLines: (update: (prev: Line[]) => Line[]) => void;
}) {
  const patch = (key: number, value: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...value } : l)));

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">{title}</p>
      <DataTable
        columns={[{ label: 'Account'}, { label:'Amount'}, { label:'' }]}
        isEmpty={false}
      >
        {lines.map((line) => (
          <Tr key={line.key}>
            <Td>
              <select
                name={accountField}
                value={line.accountId}
                onChange={(e) => patch(line.key, { accountId: e.target.value })}
                className="h-9 w-64 rounded-lg border border-border bg-transparent px-2 text-sm"
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
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
                name={amountField}
                value={line.amount}
                onChange={(e) => patch(line.key, { amount: Number(e.target.value) })}
                className="h-9 w-32 rounded-lg border border-border bg-transparent px-2 text-sm"
              />
            </Td>
            <Td>
              {lines.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Remove
                </button>
              ) : null}
            </Td>
          </Tr>
        ))}
      </DataTable>

      <button
        type="button"
        onClick={() =>
          setLines((prev) => [...prev, { key: Date.now(), accountId: '', amount: 0 }])
        }
        className="mt-3 rounded-lg px-4 py-2.5 text-sm font-medium text-primary ring-1 ring-inset ring-ring/50 hover:bg-primary/10"
      >
        Add line
      </button>
    </div>
  );
}

export function EditOpeningBalancesForm({
  periodId,
  date,
  assetAccounts,
  liabilityAccounts,
  assetLines,
  liabilityLines,
}: {
  periodId: number;
  date: string;
  assetAccounts: SelectOption[];
  liabilityAccounts: SelectOption[];
  assetLines: Array<{ accountId: number; amount: number }>;
  liabilityLines: Array<{ accountId: number; amount: number }>;
}) {
  const [state, action] = useActionState(updateOpeningBalances, EMPTY);
  const [assets, setAssets] = useState<Line[]>(
    assetLines.length
      ? assetLines.map((l, i) => ({ key: i, accountId: String(l.accountId), amount: l.amount }))
      : [{ key: 0, accountId: '', amount: 0 }],
  );
  const [liabilities, setLiabilities] = useState<Line[]>(
    liabilityLines.length
      ? liabilityLines.map((l, i) => ({
          key: i + 1000,
          accountId: String(l.accountId),
          amount: l.amount,
        }))
      : [{ key: 1000, accountId: '', amount: 0 }],
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={periodId} />
      <FormAlert variant="error" message={state.error} />

      <FormInput label="Date" name="date" type="date" defaultValue={date} required />

      <LineTable
        title="Assets"
        accountField="asset_account_id"
        amountField="asset_amount"
        accounts={assetAccounts}
        lines={assets}
        setLines={setAssets}
      />

      <LineTable
        title="Liabilities"
        accountField="liability_account_id"
        amountField="liability_amount"
        accounts={liabilityAccounts}
        lines={liabilities}
        setLines={setLiabilities}
      />

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}
