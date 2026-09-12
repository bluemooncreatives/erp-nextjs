'use client';

// The document upload form of `backEnd.staffs.viewStaff`
// (StaffController@document_store).

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { uploadStaffDocument } from '../../actions';
import type { HrFormState } from '../../actions';

const INITIAL: HrFormState = {};

export function StaffDocumentUpload({ staffId }: { staffId: number }) {
  const [state, formAction] = useActionState(uploadStaffDocument, INITIAL);

  return (
    <Card title="Upload Document">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="staff_id" value={staffId} />
        <FormAlert message={state.error} />
        <FormAlert message={state.success} variant="success" />

        <div className="grid gap-5 md:grid-cols-2">
          <FormInput label="Document Title" name="name" />
          <FormInput label="File" name="document" type="file" required />
        </div>

        <SubmitButton>Upload</SubmitButton>
      </form>
    </Card>
  );
}
