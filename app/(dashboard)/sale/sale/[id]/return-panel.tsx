'use client';

// Return entry - port of `sale::sale.return_sale`.
//
// The quantity entered per line is the TOTAL returned for that line, which is
// how `itemUpdate()` stored it (it overwrote `return_quantity`).

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormTextarea } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { storeSaleReturn, type SaleFormState } from '../../actions';

const INITIAL: SaleFormState = {};

export function ReturnPanel({
  saleId,
  items,
  disabled,
}: {
  saleId: number;
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    returnQuantity: number;
  }>;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(storeSaleReturn, INITIAL);
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.returnQuantity])),
  );

  const total = Object.values(quantities).reduce((a, b) => a + b, 0);

  return (
    <Card
      title="Return Items"
      desc={
        disabled
          ? 'This return has already been accepted.'
          : 'Enter the total quantity returned for each line.'
      }
      bodyClassName=""
    >
      <form action={formAction}>
        <input type="hidden" name="sale_id" value={saleId} />

        <div className="px-4 pt-4 sm:px-6">
          <FormAlert variant="error" message={state.error} />
        </div>

        <DataTable
          columns={[{ label: 'Product' }, { label: 'Sold' }, { label: 'Return Qty' }]}
          isEmpty={items.length === 0}
        >
          {items.map((item) => (
            <Tr key={item.id}>
              <Td className="font-medium text-foreground">
                {item.name}
                <input type="hidden" name="item_id" value={item.id} />
              </Td>
              <Td>{item.quantity}</Td>
              <Td>
                <input
                  type="number"
                  name="return_quantity"
                  min="0"
                  max={item.quantity}
                  disabled={disabled}
                  value={quantities[item.id] ?? 0}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.id]: Number(e.target.value),
                    }))
                  }
                  className="h-9 w-24 rounded-lg border border-border bg-transparent px-2 text-sm disabled:opacity-50"
                />
              </Td>
            </Tr>
          ))}
        </DataTable>

        <div className="space-y-4 p-4 sm:p-6">
          <FormTextarea label="Return Note" name="return_note" disabled={disabled} />
          <SubmitButton disabled={disabled || total === 0}>
            Submit Return
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
