import type { Metadata } from 'next';
import { CompoundVoucherEdit } from '../../../compound-edit';

export const metadata: Metadata = { title: 'Edit Journal Voucher' };

export default async function EditJournalPage({ params }: { params: Promise<{ id: string }> }) {
  return <CompoundVoucherEdit id={Number((await params).id)} kind="journal" />;
}
