// The ledger table the staff / customer / supplier history screens shared -
// an opening-balance row followed by every posting with a running balance.

import { Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Phrase } from '@/context/TranslationContext';

export type LedgerRow = {
  id: number;
  dateLabel: string;
  reference: string;
  narration: string;
  debitLabel: string;
  creditLabel: string;
  balanceLabel: string;
};

export function LedgerTable({
  title,
  desc,
  openingLabel,
  rows,
  empty = 'No transactions.',
}: {
  title: string;
  desc?: string;
  openingLabel: string;
  rows: LedgerRow[];
  empty?: string;
}) {
  return (
    <Card title={title} desc={desc} bodyClassName="">
      <DataTable
        columns={[
          { label: 'Date' },
          { label: 'Reference' },
          { label: 'Description' },
          { label: 'Debit' },
          { label: 'Credit' },
          { label: 'Balance' },
        ]}
        isEmpty={false}
      >
        <Tr>
          <Td className="font-medium"><Phrase>Openning Balance</Phrase></Td>
          <Td />
          <Td />
          <Td />
          <Td />
          <Td className="text-end">{openingLabel}</Td>
        </Tr>

        {rows.map((row) => (
          <Tr key={row.id}>
            <Td>{row.dateLabel}</Td>
            <Td>{row.reference}</Td>
            <Td>{row.narration}</Td>
            <Td>{row.debitLabel}</Td>
            <Td>{row.creditLabel}</Td>
            <Td className="text-end">{row.balanceLabel}</Td>
          </Tr>
        ))}

        {rows.length === 0 ? (
          <Tr>
            <Td colSpan={6} className="text-muted-foreground text-center">
              {empty}
            </Td>
          </Tr>
        ) : null}
      </DataTable>
    </Card>
  );
}
