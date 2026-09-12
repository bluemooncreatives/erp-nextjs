// Edit staff - port of StaffController@edit.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { departmentRepository } from '@/lib/product/repositories';
import { findStaff, roleOptions } from '@/lib/hr/staff';
import { activeShowRooms, activeWareHouses } from '@/lib/setup/repositories';
import { PageHeader } from '@/components/erp/page';
import { StaffForm } from '../../../staff-form';
import { updateStaffAction } from '../../../actions';

export const metadata: Metadata = { title: 'Edit Staff' };

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('staffs.edit');
  const { id } = await params;

  const found = await findStaff(Number(id));
  if (!found) notFound();

  const [roles, departmentRows, showrooms, warehouses] = await Promise.all([
    roleOptions(),
    departmentRepository.all(),
    activeShowRooms(),
    activeWareHouses(),
  ]);

  const roleRef = roles.find((r) => r.id === found.user.roleId)?.value ?? '';

  return (
    <>
      <PageHeader
        title="Edit Staff"
        breadcrumb={[{ label: 'Human Resource' }, { label: 'Edit Staff' }]}
      />
      <StaffForm
        action={updateStaffAction}
        roles={roles.map((r) => ({ value: r.value, label: r.label }))}
        departments={departmentRows.map((d) => ({ value: d.id, label: d.name }))}
        showrooms={showrooms.map((s) => ({ value: s.id, label: s.name }))}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        defaults={{
          id: found.staff.id,
          name: found.user.name,
          email: found.user.email ?? '',
          username: found.user.username,
          roleRef,
          departmentId: found.staff.departmentId,
          showroomId: found.staff.showroomId,
          warehouseId: found.staff.warehouseId,
          openingBalance: found.staff.openingBalance,
          bankName: found.staff.bankName,
          bankBranchName: found.staff.bankBranchName,
          bankAccountName: found.staff.bankAccountName,
          bankAccountNo: found.staff.bankAccountNo,
          basicSalary: found.staff.basicSalary,
          employmentType: found.staff.employmentType,
          provisionalMonths: found.staff.provisionalMonths,
          dateOfJoining: found.staff.dateOfJoining,
          dateOfBirth: found.staff.dateOfBirth,
          leaveApplicableDate: found.staff.leaveApplicableDate,
          currentAddress: found.staff.currentAddress,
          permanentAddress: found.staff.permanentAddress,
        }}
      />
    </>
  );
}
