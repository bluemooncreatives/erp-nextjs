// Retailer report - port of RetailerReportController@index
// (`report::retailer_report.index`), which listed the agent users.

import type { Metadata } from 'next';
import { and, eq, sql } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles, staffs, users } from '@/lib/db/schema';
import { singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'Retailer Report' };

export default async function RetailerReportPage() {
  await authorize('retailer_report.index');

  // Agents are the users whose role is the seeded "Agent" role.
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: staffs.phone,
      isActive: users.isActive,
      roleName: roles.name,
      invoices: sql<number>`(
        select count(*) from sales s where s.agent_user_id = ${users.id}
      )`,
      total: sql<number>`(
        select coalesce(sum(s.payable_amount), 0) from sales s where s.agent_user_id = ${users.id}
      )`,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(staffs, eq(staffs.userId, users.id))
    .where(and(eq(roles.name, 'Agent')))
    .orderBy(users.name);

  const decorated = await Promise.all(
    rows.map(async (row) => ({ ...row, totalLabel: await singlePrice(Number(row.total)) })),
  );

  const grandTotal = await singlePrice(
    rows.reduce((sum, r) => sum + Number(r.total), 0),
  );

  return (
    <>
      <PageHeader
        title="Retailer Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Retailer Report' }]}
      />

      <Card title={`Retailers (${rows.length}) - ${grandTotal}`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Name' },
            { label: 'Email' },
            { label: 'Phone' },
            { label: 'Invoices' },
            { label: 'Total sales' },
            { label: 'Status' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No retailers found."
        >
          {decorated.map((row) => (
            <Tr key={row.id}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">{row.name}</Td>
              <Td>{row.email ?? '-'}</Td>
              <Td>{row.phone ?? '-'}</Td>
              <Td>{row.invoices}</Td>
              <Td>{row.totalLabel}</Td>
              <Td>
                <Badge color={row.isActive === 1 ? 'success' : 'error'} size="sm">
                  {row.isActive === 1 ? 'Active' : 'Inactive'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
