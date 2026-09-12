import { authorize, can } from '@/lib/auth/permissions';
import { carryForwardRows } from '@/lib/hr/carry-forward';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { generateCarryForwardAction, setCarryForwardAction } from './actions';

export default async function CarryForwardPage() {
  await authorize('carry.forward');
  const [all, canGenerate, canUpdate] = await Promise.all([carryForwardRows(), can('generate.carry.forward'), can('carry.forward.update')]);
  const rows = all.filter((row) => row.roleId !== 1);
  return <><PageHeader title="Leave Carry Forward" actions={canGenerate ? <form action={generateCarryForwardAction}><ActionButton variant="primary" confirm="Regenerate carry-forward balances from leave records?">Generate Carry Forward</ActionButton></form> : null} />
    <Card title="Staff Balances" bodyClassName=""><DataTable columns={[{ label: 'Role' }, { label: 'Name' }, { label: 'Username' }, { label: 'Email' }, { label: 'Carry Forward' }, { label: 'Status' }]} isEmpty={!rows.length}>
      {rows.map((row) => <Tr key={row.id}><Td>{row.roleType?.replaceAll('_', ' ')}</Td><Td>{row.name}</Td><Td>{row.username}</Td><Td>{row.email}</Td>
        <Td>{row.carryForward ?? 0} (Available: {Number(row.entitlement) - Number(row.carryForward ?? 0)})</Td>
        <Td>{row.staffId && canUpdate ? <form action={setCarryForwardAction}><input type="hidden" name="id" value={row.staffId} /><input type="hidden" name="status" value={row.active ? '0' : '1'} /><ActionButton variant="primary">{row.active ? 'Disable' : 'Enable'}</ActionButton></form> : row.active ? 'Enabled' : 'Disabled'}</Td>
      </Tr>)}
    </DataTable></Card></>;
}
