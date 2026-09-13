'use client';
import { useActionState } from 'react';
import { updateFieldAction } from './field-actions';
import { FormAlert, FormInput, FormSelect, FormTextarea } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';

export type FieldControlRow = { id: number; name: string; type: string; visibility: number; isDefault: boolean; options: { id: number; label: string }[]; value: string; format: string; decimals: string; label: string; position: string };

export function FieldControl({ projectId, field, taskId, members = [] }: { projectId: number; field?: FieldControlRow; taskId?: number; members?: { id: number; name: string }[] }) {
  const [state, action] = useActionState(updateFieldAction, {});
  const isValue = !!taskId && !!field;
  return <form action={action} className="space-y-3 rounded-lg border border-border p-4">
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="field_id" value={field?.id ?? ''} />
    {taskId ? <input type="hidden" name="task_id" value={taskId} /> : null}
    <FormAlert variant="error" message={state.error} /><FormAlert variant="success" message={state.success} />
    {isValue ? <>
      {field.type === 'dropdown' || field.type === 'user_id' ? <FormSelect label={field.name} name="value" defaultValue={field.value} options={[{ value: '', label: 'None' }, ...(field.type === 'dropdown' ? field.options.map((o) => ({ value: o.id, label: o.label })) : members.map((m) => ({ value: m.id, label: m.name })))]} /> :
        <FormInput label={field.name} name="value" type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} step="any" defaultValue={field.value} />}
      <SubmitButton name="operation" value="value" size="sm">Save value</SubmitButton>
    </> : <>
      <FormInput label="Field name" name="name" defaultValue={field?.name} required maxLength={191} readOnly={field?.isDefault} />
      {field ? <><input type="hidden" name="type" value={field.type} /><p className="text-sm text-muted-foreground">{field.type}</p></> : <FormSelect label="Type" name="type" options={['text', 'number', 'date', 'dropdown', 'user_id'].map((type) => ({ value: type, label: type === 'user_id' ? 'Person' : type }))} />}
      {!field || field.type === 'number' ? <details><summary className="cursor-pointer text-sm">Number formatting</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FormSelect label="Number format" name="format" defaultValue={field?.format ?? 'unformat'} options={['unformat', 'number', 'percent', 'usd', 'custom'].map((value) => ({ value, label: value }))} />
        <FormInput label="Decimal places" name="decimals" type="number" min="0" max="6" defaultValue={field?.decimals ?? '2'} />
        <FormInput label="Custom label" name="label" maxLength={50} defaultValue={field?.label ?? ''} />
        <FormSelect label="Label position" name="position" defaultValue={field?.position ?? 'right'} options={[{ value: 'left', label: 'Before value' }, { value: 'right', label: 'After value' }]} />
      </div></details> : null}
      {!field || field.type === 'dropdown' ? <FormTextarea label="Dropdown options (one per line)" name="options" defaultValue={field?.options.map((o) => o.label).join('\n')} /> : null}
      <div className="flex gap-2">
        {!field?.isDefault ? <SubmitButton name="operation" value="save" size="sm">{field ? 'Save field' : 'Add field'}</SubmitButton> : null}
        {field ? <><SubmitButton name="operation" value="visibility" size="sm">{field.visibility ? 'Hide' : 'Show'}</SubmitButton>
          {!field.isDefault ? <SubmitButton name="operation" value="delete" size="sm">Remove field</SubmitButton> : null}</> : null}
      </div>
    </>}
  </form>;
}
