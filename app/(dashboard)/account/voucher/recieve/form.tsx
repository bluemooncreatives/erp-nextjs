'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect, FormTextarea, type SelectOption } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import { loadReceiptInvoices, saveReceiptVoucher } from './actions';
import type { AccountFormState } from '../../actions';
import { Phrase } from '@/context/TranslationContext';

export type ReceiptDefaults = {
  id?: number;
  date: string;
  creditAccountId?: number;
  debitAccountId?: number;
  amount?: number;
  narration?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  chequeNo?: string | null;
  chequeDate?: string | null;
};

export function ReceiptVoucherForm({ fromAccounts, byAccounts, defaults }: {
  fromAccounts: SelectOption[];
  byAccounts: (SelectOption & { group: number | null })[];
  defaults: ReceiptDefaults;
}) {
  const [state, action] = useActionState(saveReceiptVoucher, {} as AccountFormState);
  const [receivingId, setReceivingId] = useState(String(defaults.debitAccountId ?? ''));
  const [invoices, setInvoices] = useState<SelectOption[]>([]);
  const [invoiceKey, setInvoiceKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const request = useRef(0);
  const isBank = byAccounts.find((account) => String(account.value) === receivingId)?.group === 2;

  async function selectFrom(accountId: string) {
    if (defaults.id) return;
    const current = ++request.current;
    setInvoiceKey(current);
    setInvoices([]);
    setInvoiceError('');
    setLoading(true);
    try {
      const options = await loadReceiptInvoices(Number(accountId));
      if (current === request.current) setInvoices(options);
    } catch {
      if (current === request.current) setInvoiceError('Could not load invoices. Select the account again to retry.');
    } finally {
      if (current === request.current) setLoading(false);
    }
  }

  return <form action={action} className="space-y-6">
    {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
    <FormAlert variant="error" message={state.error} />
    <Card title="Receipt Details">
      <div className="grid gap-5 md:grid-cols-2">
        <FormInput label="Date" name="date" type="date" required defaultValue={defaults.date} error={state.fieldErrors?.date} />
        <FormSelect label="Received from" name="credit_account_id" required options={fromAccounts} placeholder="Select account" defaultValue={defaults.creditAccountId} onChange={(event) => void selectFrom(event.target.value)} error={state.fieldErrors?.credit_account_id} />
        {!defaults.id ? <div>
          <FormSelect key={invoiceKey} label="Invoice" name="invoice_id" options={invoices} placeholder={loading ? 'Loading invoices...':'Select invoice (optional)'} disabled={loading || invoices.length === 0} error={state.fieldErrors?.invoice_id} />
          <FormAlert variant="error" message={invoiceError} />
        </div> : null}
        <FormInput label="Amount" name="debit_account_amount" type="number" step="0.01" min="0.01" required defaultValue={defaults.amount} error={state.fieldErrors?.debit_account_amount} />
        <FormSelect label="Received into" name="debit_account_id" required options={byAccounts} placeholder="Select cash or bank account" value={receivingId} onChange={(event) => setReceivingId(event.target.value)} error={state.fieldErrors?.debit_account_id} />
        <FormTextarea label="Narration" name="narration" defaultValue={defaults.narration ?? ''} />
      </div>
    </Card>
    {isBank ? <Card title="Bank Details"><div className="grid gap-5 md:grid-cols-2">
      <FormInput label="Bank Name" name="bank_name" required defaultValue={defaults.bankName ?? ''} />
      <FormInput label="Bank Branch" name="bank_branch" required defaultValue={defaults.bankBranch ?? ''} />
      <FormInput label="Cheque Number" name="cheque_no" required defaultValue={defaults.chequeNo ?? ''} />
      <FormInput label="Cheque Date" name="cheque_date" type="date" required defaultValue={defaults.chequeDate ?? ''} />
    </div></Card> : null}
    <div className="flex items-center justify-end gap-4">
      <Link href={ROUTES['voucher_recieve.index']} className="text-sm text-muted-foreground"><Phrase>Cancel</Phrase></Link>
      <SubmitButton disabled={loading || !!invoiceError}>{defaults.id ? 'Update Receipt' : 'Save Receipt'}</SubmitButton>
    </div>
  </form>;
}
