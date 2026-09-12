// Create a project - port of ProjectController@create
// (`project::project.create`).

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { teamsInWorkspace } from '@/lib/project/repository';
import { PageHeader, Card } from '@/components/erp/page';
import { ProjectForm } from '../forms';

export const metadata: Metadata = { title: 'Create Project' };

export default async function ProjectCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ team_id?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const teams = user.currentWorkspaceId
    ? await teamsInWorkspace(user.currentWorkspaceId, user.id)
    : [];

  return (
    <>
      <PageHeader
        title="Create Project"
        breadcrumb={[{ label: 'Projects' }, { label: 'Create' }]}
      />
      <Card title="Project">
        <ProjectForm
          teams={teams.map((team) => ({ value: team.id, label: team.name ?? '' }))}
          teamId={sp.team_id}
        />
      </Card>
    </>
  );
}
