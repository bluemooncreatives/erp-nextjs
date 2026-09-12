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

export type ReferenceRow = {
  id: number;
  name: string;
  description?: string | null;
  status?: number | null;
  /** Extra cells rendered after the name, e.g. a category's parent. */
  extra?: Array<string | number | null>;
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
  extraFields?: (row: ReferenceRow | null) => React.ReactNode;
  breadcrumbLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<ReferenceRow | null>(null);
  const [state, formAction] = useActionState(saveAction, INITIAL);

  // Clear the form once a save succeeds.
  useEffect(() => {
    if (state.success) {
      setEditing(null);
      router.refresh();
    }
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

              {extraFields?.(editing)}

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
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
                  >
                    Cancel
                  </button>
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
              <input
                type="search"
                name="search"
                defaultValue={search ?? ''}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="h-10 w-44 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 sm:w-56"
              />
              <button
                type="submit"
                className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Search
              </button>
            </form>
          }
        >
          <DataTable
            columns={[
              { label: 'Name' },
              ...extraColumns.map((label) => ({ label })),
              ...(hasDescription ? [{ label: 'Description' }] : []),
              ...(hasStatus ? [{ label: 'Status' }] : []),
              ...(canEdit || canDelete ? [{ label: 'Action' }] : []),
            ]}
            isEmpty={rows.length === 0}
            empty={`No ${title.toLowerCase()} found.`}
          >
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {row.name}
                </Td>

                {row.extra?.map((value, i) => <Td key={i}>{value ?? '-'}</Td>)}

                {hasDescription ? (
                  <Td className="max-w-xs truncate">{row.description ?? '-'}</Td>
                ) : null}

                {hasStatus ? (
                  <Td>
                    <StatusBadge status={row.status ?? 0} />
                  </Td>
                ) : null}

                {canEdit || canDelete ? (
                  <Td>
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="rounded-lg px-2 py-1 text-theme-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                        >
                          Edit
                        </button>
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
          <p className="mt-3 text-xs text-gray-400">
            <Link href="/home">Home</Link> / {breadcrumbLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DeleteButton({ name, singular }: { name: string; singular: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(`Delete ${singular.toLowerCase()} "${name}"?`)) {
          e.preventDefault();
        }
      }}
      className="rounded-lg px-2 py-1 text-theme-xs font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
    >
      Delete
    </button>
  );
}
