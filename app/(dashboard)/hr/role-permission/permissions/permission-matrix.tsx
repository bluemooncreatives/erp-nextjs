'use client';

// The permission checkbox tree. Ticking a parent ticks its children, which is
// how the Blade view's jQuery behaved.

import { useState } from 'react';
import { Card } from '@/components/erp/page';
import { SubmitButton } from '@/components/erp/submit-button';
import { saveRolePermissions } from '../../actions';

export type PermissionNode = {
  id: number;
  name: string;
  route: string;
  /** 1 main menu, 2 sub menu, 3 action. */
  type: number;
  parentId: number | null;
  moduleId: number | null;
};

export function PermissionMatrix({
  roleId,
  roleName,
  permissions,
  granted,
}: {
  roleId: number;
  roleName: string;
  permissions: PermissionNode[];
  granted: number[];
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set(granted));

  const byParent = new Map<number, PermissionNode[]>();
  const roots: PermissionNode[] = [];
  for (const p of permissions) {
    if (p.parentId == null) {
      roots.push(p);
    } else {
      const list = byParent.get(p.parentId) ?? [];
      list.push(p);
      byParent.set(p.parentId, list);
    }
  }

  /** Every descendant id, so ticking a branch ticks everything under it. */
  const descendants = (id: number): number[] => {
    const out: number[] = [];
    const queue = [...(byParent.get(id) ?? [])];
    while (queue.length) {
      const node = queue.shift()!;
      out.push(node.id);
      queue.push(...(byParent.get(node.id) ?? []));
    }
    return out;
  };

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const family = [id, ...descendants(id)];
      if (next.has(id)) {
        for (const f of family) next.delete(f);
      } else {
        for (const f of family) next.add(f);
      }
      return next;
    });
  };

  const renderNode = (node: PermissionNode, depth: number) => {
    const children = byParent.get(node.id) ?? [];
    return (
      <div key={node.id} style={{ paddingLeft: `${depth * 20}px` }} className="py-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked.has(node.id)}
            onChange={() => toggle(node.id)}
            className="h-4 w-4 rounded border-border text-primary"
          />
          {checked.has(node.id) ? (
            <input type="hidden" name="permission_id" value={node.id} />
          ) : null}
          <span
            className={
              node.type === 1
                ? 'font-semibold text-foreground '
                : node.type === 2
                  ? 'font-medium text-foreground '
                  : 'text-muted-foreground '
            }
          >
            {node.name}
          </span>
          {node.route ? (
            <span className="text-xs text-muted-foreground">{node.route}</span>
          ) : null}
        </label>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <form action={saveRolePermissions}>
      <input type="hidden" name="role_id" value={roleId} />

      <Card
        title={`${roleName} permissions`}
        desc={`${checked.size} of ${permissions.length} granted`}
        actions={<SubmitButton size="sm">Save Permissions</SubmitButton>}
      >
        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
          {roots.map((root) => (
            <div
              key={root.id}
              className="mb-4 rounded-lg border border-border p-3"
            >
              {renderNode(root, 0)}
            </div>
          ))}
        </div>
      </Card>
    </form>
  );
}
