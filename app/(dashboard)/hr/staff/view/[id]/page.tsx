// `staffs.view` - StaffController@show.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { StaffDetail } from '../../../staff-detail';

export const metadata: Metadata = { title: 'Staff Details' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('staffs.view');
  const { id } = await params;

  return <StaffDetail id={Number(id)} />;
}
