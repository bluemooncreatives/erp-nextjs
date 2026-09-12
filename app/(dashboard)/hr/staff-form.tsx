'use client';

// Staff form - port of `backEnd.staffs.create` / `edit`.
//
// The employment and bank blocks are hidden for a system user, mirroring the
// `if ($role[1] != "system_user")` branch in UserRepository.

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import type { HrFormState } from './actions';

const INITIAL: HrFormState = {};

export type StaffFormDefaults = {
  id?: number;
  name?: string;
  email?: string;
  username?: string | null;
  roleRef?: string;
  departmentId?: number | null;
  showroomId?: number | null;
  warehouseId?: number | null;
  openingBalance?: number | null;
  bankName?: string | null;
  bankBranchName?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  basicSalary?: string | null;
  employmentType?: string | null;
  provisionalMonths?: number | null;
  dateOfJoining?: string | null;
  dateOfBirth?: string | null;
  leaveApplicableDate?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
};

export function StaffForm({
  action,
  defaults = {},
  roles,
  departments,
  showrooms,
  warehouses,
}: {
  action: (prev: HrFormState, formData: FormData) => Promise<HrFormState>;
  defaults?: StaffFormDefaults;
  /** Values are `"<role_id>-<role_type>"`. */
  roles: SelectOption[];
  departments: SelectOption[];
  showrooms: SelectOption[];
  warehouses: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [roleRef, setRoleRef] = useState(defaults.roleRef ?? '');
  const isEdit = defaults.id != null;

  const isSystemUser = roleRef.split('-')[1] === 'system_user';

  return (
    <form action={formAction} className="space-y-6">
      {isEdit ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormAlert variant="error" message={state.error} />

      <Card title="Account">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormInput
            label="Name"
            name="name"
            required
            defaultValue={defaults.name ?? ''}
            error={state.fieldErrors?.name}
          />
          <FormInput
            label="Email"
            name="email"
            type="email"
            required
            defaultValue={defaults.email ?? ''}
            error={state.fieldErrors?.email}
          />
          <FormInput
            label="Phone / Username"
            name="username"
            defaultValue={defaults.username ?? ''}
          />
          <FormSelect
            label="Role"
            name="role_id"
            required
            placeholder="Select role"
            value={roleRef}
            onChange={(e) => setRoleRef(e.target.value)}
            options={roles}
            error={state.fieldErrors?.role_id}
          />
          <FormInput
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required={!isEdit}
            error={state.fieldErrors?.password}
            hint={isEdit ? 'Leave empty to keep the current password.' : undefined}
          />
          <FormInput label="Photo" name="photo" type="file" accept="image/*" />
          <FormInput
            label="Signature"
            name="signature_photo"
            type="file"
            accept="image/*"
          />
        </div>
      </Card>

      <Card title="Placement">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormSelect
            label="Department"
            name="department_id"
            placeholder="Select department"
            defaultValue={
              defaults.departmentId != null ? String(defaults.departmentId) : ''
            }
            options={departments}
          />
          <FormSelect
            label="Branch"
            name="showroom_id"
            placeholder="Select branch"
            defaultValue={defaults.showroomId != null ? String(defaults.showroomId) : ''}
            options={showrooms}
          />
          <FormSelect
            label="Warehouse"
            name="warehouse_id"
            placeholder="Select warehouse"
            defaultValue={defaults.warehouseId != null ? String(defaults.warehouseId) : ''}
            options={warehouses}
          />
        </div>
      </Card>

      {!isSystemUser ? (
        <>
          <Card title="Employment">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <FormSelect
                label="Employment Type"
                name="employment_type"
                defaultValue={defaults.employmentType ?? 'Permanent'}
                options={[
                  { value: 'Permanent', label: 'Permanent' },
                  { value: 'Contractual', label: 'Contractual' },
                  { value: 'Part Time', label: 'Part Time' },
                  { value: 'Intern', label: 'Intern' },
                ]}
              />
              <FormInput
                label="Basic Salary"
                name="basic_salary"
                type="number"
                step="0.01"
                min="0"
                defaultValue={defaults.basicSalary ?? '0'}
              />
              <FormInput
                label="Provisional Months"
                name="provisional_months"
                type="number"
                min="0"
                defaultValue={String(defaults.provisionalMonths ?? 0)}
              />
              <FormInput
                label="Date of Joining"
                name="date_of_joining"
                type="date"
                defaultValue={defaults.dateOfJoining ?? ''}
              />
              <FormInput
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                defaultValue={defaults.dateOfBirth ?? ''}
              />
              <FormInput
                label="Leave Applicable From"
                name="leave_applicable_date"
                type="date"
                defaultValue={defaults.leaveApplicableDate ?? ''}
              />
              <FormInput
                label="Opening Balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={String(defaults.openingBalance ?? 0)}
              />
            </div>
          </Card>

          <Card title="Bank Details">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <FormInput
                label="Bank Name"
                name="bank_name"
                defaultValue={defaults.bankName ?? ''}
              />
              <FormInput
                label="Branch"
                name="bank_branch_name"
                defaultValue={defaults.bankBranchName ?? ''}
              />
              <FormInput
                label="Account Name"
                name="bank_account_name"
                defaultValue={defaults.bankAccountName ?? ''}
              />
              <FormInput
                label="Account No"
                name="bank_account_no"
                defaultValue={defaults.bankAccountNo ?? ''}
              />
            </div>
          </Card>

          <Card title="Address">
            <div className="grid gap-5 md:grid-cols-2">
              <FormTextarea
                label="Current Address"
                name="current_address"
                defaultValue={defaults.currentAddress ?? ''}
              />
              <FormTextarea
                label="Permanent Address"
                name="permanent_address"
                defaultValue={defaults.permanentAddress ?? ''}
              />
            </div>
          </Card>
        </>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['staffs.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton>{isEdit ? 'Update Staff' : 'Save Staff'}</SubmitButton>
      </div>
    </form>
  );
}
