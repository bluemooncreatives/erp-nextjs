import { LinkButton } from '@/components/common/link-button';
// Projects - the list the PHP rendered from the sidebar's project tree
// (`Modules/Project`, ProjectRepository + my_project_configuration()).

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { userProjects } from '@/lib/project/repository';
import { dateConvert } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectListPage() {
  const user = await requireUser();
  const projects = await userProjects(user.id);

  const rows = await Promise.all(
    projects.map(async (row) => ({
      ...row,
      dueLabel: row.project.dueDate ? await dateConvert(row.project.dueDate) : '-',
    })),
  );

  return (
    <>
      <PageHeader
        title="Projects"
        breadcrumb={[{ label: 'Projects' }]}
        actions={
          <div className="flex items-center gap-2">
            <LinkButton
              href={ROUTES['team.index']}
              variant="outline"
            >
              Teams
            </LinkButton>
            <LinkButton
              href={ROUTES['project.create']}
              
            >
              New Project
            </LinkButton>
          </div>
        }
      />

      <Card title={`Projects (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Project' },
            { label: 'Team' },
            { label: 'Owner' },
            { label: 'Due Date' },
            { label: 'Tasks' },
            { label: 'View' },
          ]}
          isEmpty={rows.length === 0}
          empty="No projects yet."
        >
          {rows.map((row) => (
            <Tr key={row.project.id}>
              <Td className="font-medium text-foreground">
                <Link
                  href={route('project.show', { uuid: row.project.uuid })}
                  className="text-primary hover:text-primary"
                >
                  {row.project.name}
                </Link>
              </Td>
              <Td>{row.teamName ?? '-'}</Td>
              <Td>{row.ownerName ?? '-'}</Td>
              <Td>{row.dueLabel}</Td>
              <Td>
                <Badge color={Number(row.doneCount) === Number(row.taskCount) && Number(row.taskCount) > 0 ? 'success' : 'info'} size="sm">
                  {`${row.doneCount} / ${row.taskCount}`}
                </Badge>
              </Td>
              <Td>{row.project.defaultView}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
