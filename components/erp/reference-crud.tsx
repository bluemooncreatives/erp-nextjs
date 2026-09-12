'use client';

// ---------------------------------------------------------------------------
// Reference-data screen - the list + inline form the PHP used for Brand,
// Model, Unit Type, Category, Tax, Department, Branch and Warehouse.
//
// The Blade pages put an "add" form beside a searchable table and edited rows
// through a modal; this keeps that layout, with the form switching to edit mode
// when a row is selected.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useActionState, useEffect, useState } from 'react';
import { Card } from './page';
import { DataTable, Pagination, Td, Tr, StatusBadge } from './table';
import { FormAlert, FormInput, FormSelect, FormTextarea } from './fields';
import { SubmitButton } from './submit-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ReferenceRow = {
  id: number;
  name: string;
  description?: string | null;
  status?: number | null;
  /** Extra cells rendered after the name, e.g. a category's parent. */
  extra?: Array<string | number | null>;
};

/**
 * Extra inputs for entities with more than name/description/status.
 *
 * These are declared as data, not as a render function: a server component
 * cannot hand a function to this client component, and doing so failed the
 * whole page at request time.
 */
export type ExtraField = {
  name: string;
  label: string;
  kind?: 'text' | 'number' | 'email' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  step?: string;
  min?: string;
  maxLength?: number;
  options?: Array<{ value: string | number; label: string }>;
  /** Value used when adding a new row. */
  defaultValue?: string;
  /** Value per existing row id, used when that row is being edited. */
  values?: Record<string, string>;
};

export type ReferenceFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

const INITIAL: ReferenceFormState = {};

export function ReferenceCrud({
  title,
  singular,
  rows,
  total,
  page,
  perPage,
  baseUrl,
  search,
  extraColumns = [],
  canCreate,
  canEdit,
  canDelete,
  saveAction,
  deleteAction,
  hasDescription = true,
  hasStatus = true,
  extraFields,
  breadcrumbLabel,
  /** Optional "View" link per row - the Branch list had one. */
  detailRoute,
}: {
  title: string;
  singular: string;
  rows: ReferenceRow[];
  total: number;
  page: number;
  perPage: number;
  baseUrl: string;
  search?: string;
  extraColumns?: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  saveAction: (
    prev: ReferenceFormState,
    formData: FormData,
  ) => Promise<ReferenceFormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  hasDescription?: boolean;
  hasStatus?: boolean;
  /** Extra inputs for entities with more than name/description/status. */
  extraFields?: ExtraField[];
  breadcrumbLabel?: string;
  /** URL template for the per-row "View" link, with `{id}` standing in. */
  detailRoute?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(saveAction, INITIAL);

  // The row being edited, remembered together with the success message that was
  // showing when it was picked: once a save reports a NEW success the selection
  // is stale, so the form falls back to "add" without a state update.
  const [selection, setSelection] = useState<{
    row: ReferenceRow | null;
    afterSuccess?: string;
  }>({ row: null });

  const editing = selection.afterSuccess === state.success ? selection.row : null;
  const setEditing = (row: ReferenceRow | null) =>
    setSelection({ row, afterSuccess: state.success });

  // Pull the saved row back from the server once a save succeeds.
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const params = Object.fromEntries(searchParams.entries());

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {canCreate || canEdit ? (
        <div className="col-span-12 xl:col-span-4">
          <Card title={editing ? `Edit ${singular}` : `Add ${singular}`}>
            <form action={formAction} className="space-y-4" key={editing?.id ?? 'new'}>
              {editing ? (
                <input type="hidden" name="id" value={editing.id} />
              ) : null}

              <FormAlert variant="error" message={state.error} />
              <FormAlert variant="success" message={state.success} />

              <FormInput
                label="Name"
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                error={state.fieldErrors?.name}
              />

              {hasDescription ? (
                <FormTextarea
                  label="Description"
                  name="description"
                  defaultValue={editing?.description ?? ''}
                  error={state.fieldErrors?.description}
                />
              ) : null}

              {extraFields?.map((field) => {
                const value = editing
                  ? (field.values?.[String(editing.id)] ?? '')
                  : (field.defaultValue ?? '');
                const error = state.fieldErrors?.[field.name];

                if (field.kind === 'select') {
                  return (
                    <FormSelect
                      key={field.name}
                      label={field.label}
                      name={field.name}
                      required={field.required}
                      placeholder={field.placeholder}
                      options={field.options ?? []}
                      defaultValue={value}
                      error={error}
                      hint={field.hint}
                    />
                  );
                }

                if (field.kind === 'textarea') {
                  return (
                    <FormTextarea
                      key={field.name}
                      label={field.label}
                      name={field.name}
                      required={field.required}
                      placeholder={field.placeholder}
                      defaultValue={value}
                      error={error}
                      hint={field.hint}
                    />
                  );
                }

                return (
                  <FormInput
                    key={field.name}
                    label={field.label}
                    name={field.name}
                    type={field.kind === 'number' ? 'number' : (field.kind ?? 'text')}
                    required={field.required}
                    placeholder={field.placeholder}
                    step={field.step}
                    min={field.min}
                    maxLength={field.maxLength}
                    defaultValue={value}
                    error={error}
                    hint={field.hint}
                  />
                );
              })}

              {hasStatus ? (
                <FormSelect
                  label="Status"
                  name="status"
                  defaultValue={String(editing?.status ?? 1)}
                  options={[
                    { value: 1, label: 'Active' },
                    { value: 0, label: 'DeActive' },
                  ]}
                  error={state.fieldErrors?.status}
                />
              ) : null}

              <div className="flex items-center gap-3">
                <SubmitButton>{editing ? 'Update' : 'Save'}</SubmitButton>
                {editing ? (
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <div
        className={
          canCreate || canEdit ? 'col-span-12 xl:col-span-8' : 'col-span-12'
        }
      >
        <Card
          title={title}
          bodyClassName=""
          actions={
            <form method="get" action={baseUrl} className="flex items-center gap-2">
              <Input
                type="search"
                name="search"
                defaultValue={search ?? ''}
                placeholder={`Search ${title.toLowerCase()}...`}
                aria-label={`Search ${title.toLowerCase()}`}
                className="w-44 sm:w-56"
              />
              <Button type="submit">Search</Button>
            </form>
          }
        >
          <DataTable
            columns={[
              { label: 'Name' },
              ...extraColumns.map((label) => ({ label })),
              ...(hasDescription ? [{ label: 'Description' }] : []),
              ...(hasStatus ? [{ label: 'Status' }] : []),
              ...(canEdit || canDelete || detailRoute ? [{ label: 'Action' }] : []),
            ]}
            isEmpty={rows.length === 0}
            empty={`No ${title.toLowerCase()} found.`}
          >
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium">{row.name}</Td>

                {row.extra?.map((value, i) => <Td key={i}>{value ?? '-'}</Td>)}

                {hasDescription ? (
                  <Td className="max-w-xs truncate">{row.description ?? '-'}</Td>
                ) : null}

                {hasStatus ? (
                  <Td>
                    <StatusBadge status={row.status ?? 0} />
                  </Td>
                ) : null}

                {canEdit || canDelete || detailRoute ? (
                  <Td>
                    <div className="flex items-center gap-2">
                      {detailRoute ? (
                        <Button asChild variant="ghost" size="xs">
                          <Link href={detailRoute.replace('{id}', String(row.id))}>
                            View
                          </Link>
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => setEditing(row)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <DeleteButton name={row.name} singular={singular} />
                        </form>
                      ) : null}
                    </div>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </DataTable>

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            baseUrl={baseUrl}
            params={params}
          />
        </Card>

        {breadcrumbLabel ? (
          <p className="text-muted-foreground mt-3 text-xs">
            <Link href="/home">Home</Link> / {breadcrumbLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DeleteButton({ name, singular }: { name: string; singular: string }) {
  return (
    <Button
      type="submit"
      variant="ghost"
      size="xs"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={(event) => {
        if (!window.confirm(`Delete ${singular.toLowerCase()} "${name}"?`)) {
          event.preventDefault();
        }
      }}
    >
      Delete
    </Button>
  );
}
