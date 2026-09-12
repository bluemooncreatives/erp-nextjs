// Roles - port of Modules/RolePermission RoleController.

import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { authorize, can } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles } from '@/lib/db/schema';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { deleteRole } from '../../actions';
import { RoleForm } from './role-form';

export const metadata: Metadata = { title: 'Role' };

export default async function RolesPage() {
  await authorize('permission.roles.index');

  const rows = await db
    .select({
      role: roles,
      userCount: sql<number>`(
        select count(*) from users u where u.role_id = ${roles.id}
      )`,
      permissionCount: sql<number>`(
        select count(*) from role_permission rp where rp.role_id = ${roles.id}
      )`,
    })
    .from(roles)
    .orderBy(roles.id);

  const [canCreate, canDelete, canEditPermissions] = await Promise.all([
    can('permission.roles.store'),
    can('permission.roles.destroy'),
    can('permission.permissions.edit'),
  ]);

  return (
    <>
      <PageHeader
        title="Role"
        breadcrumb={[{ label: 'Human Resource' }, { label: 'Role' }]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <RoleForm />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8' : 'col-span-12'}>
          <Card title={`Roles (${rows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Role' },
                { label: 'Type' },
                { label: 'Users' },
                { label: 'Permissions' },
                { label: 'Action' },
              ]}
              isEmpty={rows.length === 0}
            >
              {rows.map((row) => (
                <Tr key={row.role.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {row.role.name}
                  </Td>
                  <Td>
                    <Badge
                      size="sm"
                      color={row.role.type === 'system_user' ? 'primary' : 'light'}
                    >
                      {row.role.type}
                    </Badge>
                  </Td>
                  <Td>{Number(row.userCount)}</Td>
                  <Td>
                    {row.role.type === 'system_user'
                      ? 'All (bypasses checks)'
                      : Number(row.permissionCount)}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {canEditPermissions && row.role.type !== 'system_user' ? (
                        <Link
                          href={`${ROUTES['permission.permissions.index']}?role_id=${row.role.id}`}
                          className="rounded-lg px-2 py-1 text-theme-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                        >
                          Permissions
                        </Link>
                      ) : null}
                      {canDelete && row.role.id > 5 ? (
                        <form action={deleteRole}>
                          <input type="hidden" name="id" value={row.role.id} />
                          <ActionButton confirm={`Delete role "${row.role.name}"?`}>
                            Delete
                          </ActionButton>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>
      </div>
    </>
  );
}
