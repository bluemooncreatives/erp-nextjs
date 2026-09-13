'use client';

// Apply-leave form - port of `leave::apply_leaves.create`.
//
// The `day` selector decides whether an end date and half-day markers apply,
// which is what the repository uses to work out `total_days`.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormCheckbox,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import {
  storeLeaveApplication,
  updateLeaveApplicationAction,
  type LeaveFormState,
} from './actions';

const INITIAL: LeaveFormState = {};

/** A submitted application being amended - `apply_leave.edit` / `.update`. */
export type EditingLeave = {
  id: number;
  leaveTypeId: number;
  day: number;
  applyDate: string;
  startDate: string;
  endDate: string | null;
  reason: string;
  makeupLeave: number;
  makeupDate: string | null;
  makeupHalf: number;
};

export function ApplyLeaveForm({
  leaveTypes,
  balance,
  /** Staff to apply on behalf of - the Blade only showed this to system users. */
  users,
  currentUserId,
  editing,
}: {
  leaveTypes: SelectOption[];
  balance: { entitlement: number; taken: number; remaining: number };
  users?: SelectOption[];
  currentUserId?: number;
  editing?: EditingLeave | null;
}) {
  const [state, formAction] = useActionState(
    editing ? updateLeaveApplicationAction : storeLeaveApplication,
    INITIAL,
  );
  const [day, setDay] = useState(editing ? String(editing.day) : '1');
  const [makeup, setMakeup] = useState(Boolean(editing?.makeupLeave));

  const isRange = day === '2';

  return (
    <Card
      title={editing ? 'Edit Leave Application' : 'Apply for Leave'}
      desc={`Entitlement ${balance.entitlement} / taken ${balance.taken} / remaining ${balance.remaining}`}
    >
      <form action={formAction} className="space-y-4">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

        <FormAlert variant="error" message={state.error} />

        {users?.length ? (
          <FormSelect
            label="User"
            name="user"
            required
            options={users}
            defaultValue={currentUserId != null ? String(currentUserId) : ''}
          />
        ) : null}

        <FormSelect
          label="Leave Type"
          name="leave_type_id"
          required
          placeholder="Select type"
          options={leaveTypes}
          defaultValue={editing ? String(editing.leaveTypeId) : ''}
          error={state.fieldErrors?.leave_type_id}
        />

        <FormSelect
          label="Duration"
          name="day"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          options={[
            { value: '1', label: 'Single day' },
            { value: '2', label: 'Date range' },
            { value: '0', label: 'Half day' },
          ]}
        />

        <FormInput
          label="Apply Date"
          name="apply_date"
          type="date"
          required
          defaultValue={editing?.applyDate ?? new Date().toISOString().slice(0, 10)}
        />

        <FormInput
          label={isRange ? 'Start Date' : 'Date'}
          name="start_date"
          type="date"
          required
          defaultValue={editing?.startDate ?? ''}
          error={state.fieldErrors?.start_date}
        />

        {isRange ? (
          <>
            <FormInput
              label="End Date"
              name="end_date"
              type="date"
              required
              defaultValue={editing?.endDate ?? ''}
              error={state.fieldErrors?.end_date}
            />
            <FormCheckbox label="First day is a half day" name="half" value="1" />
            <FormCheckbox label="Last day is a half day" name="half_to" value="1" />
          </>
        ) : null}

        <FormTextarea
          label="Reason"
          name="reason"
          required
          defaultValue={editing?.reason ?? ''}
          error={state.fieldErrors?.reason}
        />

        <FormCheckbox
          label="Offer a makeup day"
          name="makeup_leave"
          value="1"
          checked={makeup}
          onChange={(e) => setMakeup(e.target.checked)}
        />

        {makeup ? (
          <>
            <FormInput
              label="Makeup Date"
              name="makeup_date"
              type="date"
              defaultValue={editing?.makeupDate ?? ''}
            />
            {/* `makeup_half` - which half of the makeup day is worked. */}
            <FormSelect
              label="Makeup Half"
              name="makeup_half"
              defaultValue={editing?.makeupHalf ? String(editing.makeupHalf) : ''}
              placeholder="Full day"
              options={[
                { value: 1, label: 'First Half' },
                { value: 2, label: 'Second Half' },
              ]}
            />
          </>
        ) : null}

        <FormInput label="Attachment" name="file" type="file" />

        <SubmitButton>
          {editing ? 'Update Application' : 'Submit Application'}
        </SubmitButton>
      </form>
    </Card>
  );
}
