'use client';

import { VoucherForm } from '../../voucher-form';
import { storeContraVoucher } from '../../actions';
import { ROUTES } from '@/lib/routes';
import type { SelectOption } from '@/components/erp/fields';

// ContraVoucherController uses one main account and multiple opposite-side lines.
export function ContraVoucherForm({ accounts, currencySymbol }: { accounts: SelectOption[]; currencySymbol: string }) {
  return <VoucherForm action={storeContraVoucher} heading="Contra Voucher Details"
    mainAccountLabel="Main account" mainAccounts={accounts}
    lineAccountLabel="Contra account" lineAccounts={accounts}
    currencySymbol={currencySymbol} cancelHref={ROUTES['contra.index']}
    submitLabel="Save Contra Voucher" showPaymentMethod={false} showAccountTypeToggle />;
}
