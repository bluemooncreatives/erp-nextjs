import type { Metadata } from 'next';
import { CompoundVoucherEdit } from '../../../compound-edit';

export const metadata: Metadata = { title: 'Edit Contra Voucher' };

export default async function EditContraPage({ params }: { params: Promise<{ id: string }> }) {
  return <CompoundVoucherEdit id={Number((await params).id)} kind="contra" />;
}
