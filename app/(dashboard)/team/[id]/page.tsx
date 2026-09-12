// Team detail - port of TeamController@show, with its projects, members and
// the invite form (`team.invite.create`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, forbidden } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findTeam } from '@/lib/project/repository';
import { dateConvert } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { removeFromTeam } from '../../project/actions';
import { TeamSettingsForm, TeamInviteForm } from '../../project/forms';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const record = await findTeam(Number(id));
  if (!record) notFound();

  const { team, members, projects } = record;

  // `TeamService::show()` - only the owner or a member may open a team.
  const isMember = team.userId === user.id || members.some((m) => m.id === user.id);
  if (!isMember) forbidden();

  const projectRows = await Promise.all(
    projects.map(async (project) => ({
      project,
      dueLabel: project.dueDate ? await dateConvert(project.dueDate) : '-',
    })),
  );

  return (
    <>
      <PageHeader
        title={team.name ?? 'Team'}
        breadcrumb={[
          { label: 'Teams', href: ROUTES['team.index'] },
          { label: team.name ?? '' },
        ]}
        actions={
          <Link
            href={`${ROUTES['project.create']}?team_id=${team.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            New Project
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title={`Projects (${projectRows.length})`} bodyClassName="">
          <DataTable
            columns={[{ label: 'Project' }, { label: 'Due Date' }, { label: 'View' }]}
            isEmpty={projectRows.length === 0}
            empty="No projects in this team."
          >
            {projectRows.map((row) => (
              <Tr key={row.project.id}>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  <Link
                    href={route('project.show', { uuid: row.project.uuid })}
                    className="text-brand-500 hover:text-brand-600"
                  >
                    {row.project.name}
                  </Link>
                </Td>
                <Td>{row.dueLabel}</Td>
                <Td>{row.project.defaultView}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        <div className="space-y-5">
          <Card title="Team">
            <TeamSettingsForm
              team={{
                id: team.id,
                name: team.name ?? '',
                description: team.description ?? '',
              }}
            />
          </Card>

          <Card title={`Members (${members.length})`} bodyClassName="">
            <DataTable
              columns={[{ label: 'Name' }, { label: 'Email' }, { label: '' }]}
              isEmpty={members.length === 0}
              empty="No members."
            >
              {members.map((member) => (
                <Tr key={member.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {member.name}
                  </Td>
                  <Td>{member.email ?? '-'}</Td>
                  <Td>
                    {member.id !== team.userId ? (
                      <form action={removeFromTeam}>
                        <input type="hidden" name="team_id" value={team.id} />
                        <input type="hidden" name="user_id" value={member.id} />
                        <ActionButton confirm="Remove this member?">Remove</ActionButton>
                      </form>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </DataTable>

            <div className="p-4 sm:p-6">
              <TeamInviteForm teamId={team.id} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
