'use client';

// `backEnd.profiles.password` and `backEnd.profiles.editProfile`.

import { useActionState } from 'react';
import { FormAlert, FormInput, FormActions } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { changePassword, updateProfile, type ProfileFormState } from './profile-actions';
import { Phrase } from '@/context/TranslationContext';

const EMPTY: ProfileFormState = {};

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, EMPTY);

  return (
    <form action={action} className="max-w-lg space-y-5">
      <FormAlert variant="error" message={state.error} />

      <FormInput
        label="Current Password"
        name="current_password"
        type="password"
        required
        error={state.fieldErrors?.current_password}
      />
      <FormInput
        label="New Password"
        name="password"
        type="password"
        required
        error={state.fieldErrors?.password}
      />
      <FormInput
        label="Confirm Password"
        name="password_confirmation"
        type="password"
        required
        error={state.fieldErrors?.password_confirmation}
      />

      <FormActions>
        <SubmitButton><Phrase>Save</Phrase></SubmitButton>
      </FormActions>
    </form>
  );
}

export function EditProfileForm({
  profile,
  showBankFields,
}: {
  profile: {
    name: string;
    email: string;
    phone: string;
    bankName: string;
    bankBranchName: string;
    bankAccountName: string;
    bankAccountNo: string;
    currentAddress: string;
    permanentAddress: string;
  };
  showBankFields: boolean;
}) {
  const [state, action] = useActionState(updateProfile, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="Name"
          name="name"
          defaultValue={profile.name}
          required
          error={state.fieldErrors?.name}
        />
        <FormInput
          label="Email"
          name="email"
          type="email"
          defaultValue={profile.email}
          required
          error={state.fieldErrors?.email}
        />
        <FormInput
          label="Phone"
          name="phone"
          defaultValue={profile.phone}
          error={state.fieldErrors?.phone}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            <Phrase>Avatar</Phrase>
          </label>
          <input
            type="file"
            name="avatar"
            accept="image/*"
            className="block w-full text-xs text-muted-foreground file:me-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
          />
        </div>
      </div>

      {showBankFields ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <FormInput
            label="Bank Name"
            name="bank_name"
            defaultValue={profile.bankName}
            required
            error={state.fieldErrors?.bank_name}
          />
          <FormInput
            label="Bank Branch Name"
            name="bank_branch_name"
            defaultValue={profile.bankBranchName}
            required
            error={state.fieldErrors?.bank_branch_name}
          />
          <FormInput
            label="Bank Account Name"
            name="bank_account_name"
            defaultValue={profile.bankAccountName}
            required
            error={state.fieldErrors?.bank_account_name}
          />
          <FormInput
            label="Bank Account No"
            name="bank_account_no"
            defaultValue={profile.bankAccountNo}
            required
            error={state.fieldErrors?.bank_account_no}
          />
          <FormInput
            label="Current Address"
            name="current_address"
            defaultValue={profile.currentAddress}
            required
            error={state.fieldErrors?.current_address}
          />
          <FormInput
            label="Permanent Address"
            name="permanent_address"
            defaultValue={profile.permanentAddress}
            required
            error={state.fieldErrors?.permanent_address}
          />
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="New Password"
          name="password"
          type="password"
          hint="Leave blank to keep the current password"
          error={state.fieldErrors?.password}
        />
        <FormInput
          label="Confirm Password"
          name="password_confirmation"
          type="password"
          error={state.fieldErrors?.password_confirmation}
        />
      </div>

      <FormActions>
        <SubmitButton><Phrase>Save</Phrase></SubmitButton>
      </FormActions>
    </form>
  );
}
