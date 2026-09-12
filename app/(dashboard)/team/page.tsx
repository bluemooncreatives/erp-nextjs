import { LinkButton } from '@/components/common/link-button';
// Teams - port of TeamController@index, listing the current workspace's teams.

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { teamsInWorkspace } from '@/lib/project/repository';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { TeamForm } from '../project/forms';

export const metadata: Metadata = { title: 'Teams' };

export default async function TeamListPage() {
  const user = await requireUser();

  const teams = user.currentWorkspaceId
    ? await teamsInWorkspace(user.currentWorkspaceId, user.id)
    : [];

  return (
    <>
      <PageHeader
        title="Teams"
        breadcrumb={[{ label: 'Projects' }, { label: 'Teams' }]}
        actions={
          <LinkButton
            href={ROUTES['workspaces.index']}
            variant="outline"
          >
            Workspaces
          </LinkButton>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title={`Teams (${teams.length})`} bodyClassName="">
          <DataTable
            columns={[
              { label: 'Team' },
              { label: 'Description' },
              { label: 'Privacy' },
              { label: '' },
            ]}
            isEmpty={teams.length === 0}
            empty={
              user.currentWorkspaceId
                ? 'No teams in this workspace.'
                : 'Create a workspace first.'
            }
          >
            {teams.map((team) => (
              <Tr key={team.id}>
                <Td className="font-medium text-foreground">
                  <Link
                    href={route('team.show', { id: team.id })}
                    className="text-primary hover:text-primary"
                  >
                    {team.name}
                  </Link>
                </Td>
                <Td>{team.description ?? '-'}</Td>
                <Td>
                  <Badge color={team.privacyType === 1 ? 'warning':'success'} size="sm">
                    {team.privacyType === 1 ? 'Private':'Public'}
                  </Badge>
                </Td>
                <Td>
                  <Link
                    href={`${ROUTES['project.create']}?team_id=${team.id}`}
                    className="text-xs font-medium text-primary hover:text-primary"
                  >
                    New project
                  </Link>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        <Card title="Create Team">
          <TeamForm />
        </Card>
      </div>
    </>
  );
}
