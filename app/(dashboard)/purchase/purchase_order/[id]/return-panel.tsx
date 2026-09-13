'use client';

// Purchase return entry - `PurchaseOrderController@purchaseReturn` /
// `@returnItem` (`purchase::purchase_order.return_purchase`).
//
// The mirror of the sale side's return panel. Without it the Purchase Return
// List could approve returns but nothing could create one, so the only rows it
// could ever act on were those Laravel had written.
//
// As on the sale side, the quantity entered per line is the TOTAL returned for
// that line - `recordPurchaseReturn` overwrites `return_quantity` rather than
// adding to it.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { storePurchaseReturn, type PurchaseFormState } from '../../actions';

const INITIAL: PurchaseFormState = {};

export function PurchaseReturnPanel({
  purchaseId,
  items,
  disabled,
}: {
  purchaseId: number;
  items: Array<{
    id: number;
    name: string;
    /** Ordered quantity - the ceiling on what can come back. */
    quantity: number;
    returnQuantity: number;
  }>;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(storePurchaseReturn, INITIAL);
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(items.map((item) => [item.id, item.returnQuantity])),
  );

  const total = Object.values(quantities).reduce((sum, value) => sum + value, 0);

  return (
    <Card
      title="Return Items"
      desc={
        disabled
          ? 'This return has already been approved.'
          : 'Enter the total quantity returned for each line.'
      }
      bodyClassName=""
    >
      <form action={formAction}>
        <input type="hidden" name="purchase_id" value={purchaseId} />

        <div className="px-4 pt-4 sm:px-6">
          <FormAlert variant="error" message={state.error} />
        </div>

        <DataTable
          columns={[{ label: 'Product' }, { label: 'Purchased' }, { label: 'Return Qty' }]}
          isEmpty={items.length === 0}
          empty="This order has no lines to return."
        >
          {items.map((item) => (
            <Tr key={item.id}>
              <Td className="text-foreground font-medium">
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
                  onChange={(event) =>
                    setQuantities((previous) => ({
                      ...previous,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                  className="border-border h-9 w-24 rounded-lg border bg-transparent px-2 text-sm disabled:opacity-50"
                />
              </Td>
            </Tr>
          ))}
        </DataTable>

        <div className="p-4 sm:p-6">
          <SubmitButton disabled={disabled || total === 0}>Submit Return</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
