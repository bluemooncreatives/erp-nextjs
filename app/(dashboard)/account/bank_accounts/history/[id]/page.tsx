import { notFound } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { findBankAccount } from '@/lib/accounting/expenses';
import { db } from '@/lib/db/client';
import { openingBalanceHistories, transactions, vouchers } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Phrase } from '@/context/TranslationContext';

export default async function BankHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('bank.account.history');
  const id = Number((await params).id);
  const bank = Number.isSafeInteger(id) && id > 0 ? await findBankAccount(id) : null;
  if (!bank) notFound();
  const [[opening], rows] = await Promise.all([
    db.select({ amount: sql<number>`coalesce(sum(${openingBalanceHistories.amount}), 0)` }).from(openingBalanceHistories).where(and(eq(openingBalanceHistories.accountId, bank.chartAccountId), eq(openingBalanceHistories.isDefault, 0))),
    db.select({ id: transactions.id, type: transactions.type, amount: transactions.amount, narration: vouchers.narration, date: vouchers.date, txId: vouchers.txId })
      .from(transactions).leftJoin(vouchers, and(eq(vouchers.id, transactions.voucherableId), eq(transactions.voucherableType, MorphType.Voucher)))
      .where(eq(transactions.accountId, bank.chartAccountId)).orderBy(transactions.id),
  ]);
  const running: Array<(typeof rows)[number] & { balance: number }> = [];
  for (const row of rows) {
    const previous = running.at(-1)?.balance ?? Number(opening?.amount ?? 0);
    running.push({ ...row, balance: previous + (row.type === 'Dr' ? Number(row.amount) : -Number(row.amount)) });
  }
  const balance = running.at(-1)?.balance ?? Number(opening?.amount ?? 0);
  const decorated = await Promise.all(running.map(async (row) => ({ ...row, dateLabel: await dateConvert(row.date), amountLabel: await singlePrice(row.amount), balanceLabel: await singlePrice(row.balance) })));
  return <><PageHeader title={`${bank.bankName} — Account History`} /><Card title={`Current Balance: ${await singlePrice(balance)}`} bodyClassName="">
    <DataTable columns={[{ label: 'Date' }, { label: 'Voucher' }, { label: 'Narration' }, { label: 'Debit' }, { label: 'Credit' }, { label: 'Balance' }]} isEmpty={false}>
      <Tr><Td colSpan={5}><Phrase>Opening Balance</Phrase></Td><Td>{await singlePrice(opening?.amount ?? 0)}</Td></Tr>
      {decorated.map((row) => <Tr key={row.id}><Td>{row.dateLabel}</Td><Td>{row.txId}</Td><Td>{row.narration}</Td><Td>{row.type === 'Dr' ? row.amountLabel : '-'}</Td><Td>{row.type === 'Cr' ? row.amountLabel : '-'}</Td><Td>{row.balanceLabel}</Td></Tr>)}
    </DataTable></Card></>;
}
