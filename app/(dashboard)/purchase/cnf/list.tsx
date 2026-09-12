'use client';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { FormInput, FormTextarea } from '@/components/erp/fields';
import type { CNFsRow } from '@/lib/db/schema';
import { saveCnf, deleteCnf } from './actions';

export function CnfList({ rows, total, page, perPage, search, canCreate, canEdit, canDelete }: {
  rows: CNFsRow[]; total: number; page: number; perPage: number; search?: string; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
  return <ReferenceCrud title="CNF Agents" singular="CNF Agent" rows={rows.map((row) => ({ id: row.id, name: row.name ?? '', status: row.status, extra: [row.address, row.email, row.phone] }))}
    total={total} page={page} perPage={perPage} search={search} baseUrl="/purchase/cnf" hasDescription={false}
    extraColumns={['Address', 'Email', 'Phone']} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} saveAction={saveCnf} deleteAction={deleteCnf}
    extraFields={(row) => { const source = rows.find((item) => item.id === row?.id); return <>
      <FormInput label="Email" name="email" type="email" defaultValue={source?.email ?? ''} />
      <FormInput label="Phone" name="phone" defaultValue={source?.phone ?? ''} />
      <FormTextarea label="Address" name="address" defaultValue={source?.address ?? ''} />
    </>; }} />;
}
