// Permissions - port of Modules/RolePermission PermissionController.
//
// The `permissions` table is a 3-level tree (`type` 1 main menu, 2 sub menu,
// 3 action) joined by `parent_id`. Checking a role's boxes writes
// `role_permission` rows, which is exactly what the menus and `authorize()`
// read back.

import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { permissions, rolePermission, roles } from '@/lib/db/schema';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { PermissionMatrix } from './permission-matrix';
import { SelectControl } from '@/components/erp/select-control';

export const metadata: Metadata = { title: 'Permission' };

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role_id?: string }>;
}) {
  await authorize('permission.permissions.index');
  const sp = await searchParams;

  const roleRows = await db.select().from(roles).orderBy(roles.id);
  const roleId = sp.role_id ? Number(sp.role_id) : null;

  const allPermissions = await db
    .select()
    .from(permissions)
    .where(eq(permissions.status, 1))
    .orderBy(asc(permissions.moduleId), asc(permissions.id));

  const granted = roleId
    ? (
        await db
          .select({ permissionId: rolePermission.permissionId })
          .from(rolePermission)
          .where(eq(rolePermission.roleId, roleId))
      )
        .map((r) => r.permissionId)
        .filter((v): v is number => v != null)
    : [];

  const selectedRole = roleRows.find((r) => r.id === roleId) ?? null;

  return (
    <>
      <PageHeader
        title="Permission"
        breadcrumb={[{ label: 'Human Resource'}, { label:'Permission' }]}
        actions={
          <form
            action={ROUTES['permission.permissions.index']}
            method="get"
            className="flex items-center gap-2"
          >
            <SelectControl
              name="role_id"
              defaultValue={roleId ? String(roleId) : ''}
              placeholder="Select a role"
              aria-label="Role"
              options={roleRows.map((r) => ({ value: String(r.id), label: r.name }))}
              className="sm:w-56"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary"
            >
              Load
            </button>
          </form>
        }
      />

      {!selectedRole ? (
        <Card title="Permissions">
          <EmptyState message="Choose a role to edit its permissions." />
        </Card>
      ) : selectedRole.type === 'system_user' ? (
        <Card title={`${selectedRole.name} permissions`}>
          <EmptyState message="System users bypass every permission check, so there is nothing to configure." />
        </Card>
      ) : (
        <PermissionMatrix
          roleId={selectedRole.id}
          roleName={selectedRole.name}
          permissions={allPermissions.map((p) => ({
            id: p.id,
            name: p.name ?? '',
            route: p.route ?? '',
            type: p.type ?? 3,
            parentId: p.parentId,
            moduleId: p.moduleId,
          }))}
          granted={granted}
        />
      )}
    </>
  );
}
