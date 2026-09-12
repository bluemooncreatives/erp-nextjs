'use client';

// `attendance::events.index` - the event form (which doubled as the edit form
// when a row was selected) and the dashboard's to-do form.

import { useActionState } from 'react';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  FormActions,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeEvent, saveEvent, storeToDo, type EventFormState } from './actions';

const EMPTY: EventFormState = {};

export function EventForm({
  event,
  roles,
}: {
  event?: {
    id: number;
    title: string;
    forWhom: string;
    location: string;
    description: string;
    fromDate: string;
    toDate: string;
  } | null;
  roles: SelectOption[];
}) {
  const [state, action] = useActionState(event ? saveEvent : storeEvent, EMPTY);

  return (
    <form action={action} className="space-y-5" key={event?.id ?? 'new'}>
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <FormInput
        label="Title"
        name="title"
        defaultValue={event?.title ?? ''}
        required
        error={state.fieldErrors?.title}
      />

      <FormSelect
        label="For Whom"
        name="for_whom"
        defaultValue={event?.forWhom ?? 'all'}
        options={[{ value: 'all', label: 'All' }, ...roles]}
      />

      <FormInput label="Location" name="location" defaultValue={event?.location ?? ''} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="From Date"
          name="from_date"
          type="date"
          defaultValue={event?.fromDate ?? ''}
          required
          error={state.fieldErrors?.from_date}
        />
        <FormInput
          label="To Date"
          name="to_date"
          type="date"
          defaultValue={event?.toDate ?? ''}
        />
      </div>

      <FormTextarea
        label="Description"
        name="description"
        rows={4}
        defaultValue={event?.description ?? ''}
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Image
        </label>
        <input
          type="file"
          name="image"
          accept="image/*"
          className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
        />
      </div>

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ToDoForm() {
  const [state, action] = useActionState(storeToDo, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <FormInput
        label="Title"
        name="title"
        required
        error={state.fieldErrors?.title}
      />
      <FormInput
        label="Date"
        name="date"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
        required
        error={state.fieldErrors?.date}
      />

      <FormActions>
        <SubmitButton size="sm">Add</SubmitButton>
      </FormActions>
    </form>
  );
}
