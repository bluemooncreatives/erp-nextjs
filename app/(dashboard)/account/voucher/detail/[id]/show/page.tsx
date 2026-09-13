import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { findVoucher } from '@/lib/accounting/vouchers';
import { db } from '@/lib/db/client';
import { chartAccounts, documents, transactions } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Voucher Details' };

export default async function VoucherDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('vouchers.show');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const voucher = await findVoucher(id);
  if (!voucher) notFound();
  const [legs, [document]] = await Promise.all([
    db.select({ id: transactions.id, type: transactions.type, amount: transactions.amount, narration: transactions.narration, accountName: chartAccounts.name, accountCode: chartAccounts.code })
      .from(transactions).leftJoin(chartAccounts, eq(chartAccounts.id, transactions.accountId))
      .where(and(eq(transactions.voucherableType, MorphType.Voucher), eq(transactions.voucherableId, id))).orderBy(transactions.id),
    db.select().from(documents).where(eq(documents.voucherId, id)).limit(1),
  ]);
  const decorated = await Promise.all(legs.map(async (leg) => ({ ...leg, amountLabel: await singlePrice(leg.amount) })));
  return <div className="space-y-6">
    <PageHeader title={`Voucher ${voucher.txId ?? id}`} breadcrumb={[{ label: 'Accounts'}, { label:'Voucher Details' }]}
      actions={<Link className="text-primary" href={voucher.paymentType === 'voucher_recieve' ? ROUTES['voucher_recieve.index'] : ROUTES['vouchers.index']}>Back to vouchers</Link>} />
    <Card title="Voucher Details"><dl className="grid gap-4 text-sm text-foreground md:grid-cols-3">
      <div><dt><Phrase>Date</Phrase></dt><dd>{await dateConvert(voucher.date)}</dd></div>
      <div><dt><Phrase>Amount</Phrase></dt><dd>{await singlePrice(voucher.amount)}</dd></div>
      <div><dt><Phrase>Approval</Phrase></dt><dd>{voucher.isApprove === 1 ? 'Approved' : voucher.isApprove === 2 ? 'Cancelled':'Pending'}</dd></div>
      <div><dt><Phrase>Narration</Phrase></dt><dd>{voucher.narration ?? '-'}</dd></div>
    </dl></Card>
    <Card title="Postings" bodyClassName=""><DataTable columns={[{ label: 'Account'}, { label:'Debit'}, { label:'Credit'}, { label:'Narration' }]} isEmpty={!legs.length}>
      {decorated.map((leg) => <Tr key={leg.id}><Td>{leg.accountName} ({leg.accountCode})</Td><Td>{leg.type === 'Dr' ? leg.amountLabel : '-'}</Td><Td>{leg.type === 'Cr' ? leg.amountLabel : '-'}</Td><Td>{leg.narration ?? '-'}</Td></Tr>)}
    </DataTable></Card>
    {document ? <Card title="Bank Details"><dl className="grid gap-4 text-sm text-foreground md:grid-cols-2">
      <div><dt><Phrase>Bank</Phrase></dt><dd>{document.bankName ?? '-'}</dd></div><div><dt><Phrase>Branch</Phrase></dt><dd>{document.bankBranch ?? '-'}</dd></div>
      <div><dt><Phrase>Cheque Number</Phrase></dt><dd>{document.chequeNo ?? '-'}</dd></div><div><dt><Phrase>Cheque Date</Phrase></dt><dd>{await dateConvert(document.chequeDate)}</dd></div>
    </dl></Card> : null}
  </div>;
}
