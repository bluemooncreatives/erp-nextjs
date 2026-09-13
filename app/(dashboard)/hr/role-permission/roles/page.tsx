import { LinkButton } from '@/components/common/link-button';
// Roles - port of Modules/RolePermission RoleController.

import type { Metadata } from 'next';
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
import { ReportSummary } from '@/components/erp/report-summary';
import { KeyRound, Shield, UserCog, Users } from 'lucide-react';
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

  const assignedUsers = rows.reduce((sum, row) => sum + Number(row.userCount ?? 0), 0);
  const grantedPermissions = rows.reduce((sum, row) => sum + Number(row.permissionCount ?? 0), 0);
  // A role nobody holds is usually one that was superseded and never removed.
  const unusedRoles = rows.filter((row) => Number(row.userCount ?? 0) === 0).length;

  return (
    <>
      <PageHeader
        title="Role"
        breadcrumb={[{ label: 'Human Resource'}, { label:'Role' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Roles', value: rows.length, detail: 'Defined in total', icon: Shield },
          { label: 'Users assigned', value: assignedUsers, detail: 'Holding one of these roles', icon: Users },
          { label: 'Permissions granted', value: grantedPermissions, detail: 'Added across every role', icon: KeyRound },
          { label: 'Unused roles', value: unusedRoles, detail: 'Nobody is assigned to', icon: UserCog },
        ]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <RoleForm />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8':'col-span-12'}>
          <Card title="All roles" bodyClassName="">
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
                  <Td className="font-medium text-foreground">
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
                        <LinkButton
                          href={`${ROUTES['permission.permissions.index']}?role_id=${row.role.id}`}
                          
                        >
                          Permissions
                        </LinkButton>
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
