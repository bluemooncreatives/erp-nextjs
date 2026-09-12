// Workspaces - port of WorkspaceController@index, plus the switcher
// (`User::switchWorkspace()`).

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { userWorkspaces } from '@/lib/project/repository';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { selectWorkspace } from '../project/actions';
import { WorkspaceForm } from '../project/forms';

export const metadata: Metadata = { title: 'Workspaces' };

export default async function WorkspacesPage() {
  const user = await requireUser();
  const workspaces = await userWorkspaces(user.id);

  return (
    <>
      <PageHeader
        title="Workspaces"
        breadcrumb={[{ label: 'Projects' }, { label: 'Workspaces' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title={`Workspaces (${workspaces.length})`} bodyClassName="">
          <DataTable
            columns={[{ label: 'Name' }, { label: 'Status' }, { label: '' }]}
            isEmpty={workspaces.length === 0}
            empty="No workspaces yet."
          >
            {workspaces.map((workspace) => (
              <Tr key={workspace.id}>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {workspace.name}
                </Td>
                <Td>
                  {workspace.id === user.currentWorkspaceId ? (
                    <Badge color="success" size="sm">
                      Current
                    </Badge>
                  ) : null}
                </Td>
                <Td>
                  {workspace.id !== user.currentWorkspaceId ? (
                    <form action={selectWorkspace}>
                      <input type="hidden" name="workspace_id" value={workspace.id} />
                      <ActionButton variant="primary">Switch to</ActionButton>
                    </form>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        <Card title="Create Workspace">
          <WorkspaceForm />
        </Card>
      </div>
    </>
  );
}
