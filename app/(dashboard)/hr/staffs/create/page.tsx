// Add staff - port of StaffController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { departmentRepository } from '@/lib/product/repositories';
import { roleOptions } from '@/lib/hr/staff';
import { activeShowRooms, activeWareHouses } from '@/lib/setup/repositories';
import { PageHeader } from '@/components/erp/page';
import { StaffForm } from '../../staff-form';
import { storeStaff } from '../../actions';

export const metadata: Metadata = { title: 'Add Staff' };

export default async function CreateStaffPage() {
  await authorize('staffs.store');

  const [roles, departmentRows, showrooms, warehouses] = await Promise.all([
    roleOptions(),
    departmentRepository.all(),
    activeShowRooms(),
    activeWareHouses(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Staff"
        breadcrumb={[{ label: 'Human Resource' }, { label: 'Add Staff' }]}
      />
      <StaffForm
        action={storeStaff}
        roles={roles.map((r) => ({ value: r.value, label: r.label }))}
        departments={departmentRows.map((d) => ({ value: d.id, label: d.name }))}
        showrooms={showrooms.map((s) => ({ value: s.id, label: s.name }))}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
      />
    </>
  );
}
