'use client';

// Receive-into-stock panel - port of the purchase receive screen.
//
// Receiving recomputes the weighted-average cost of goods for each SKU, so the
// quantity entered here is what actually arrived.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { receiveStockAction, type PurchaseFormState } from '../../actions';

const INITIAL: PurchaseFormState = {};

export function ReceivePanel({
  purchaseId,
  items,
}: {
  purchaseId: number;
  items: Array<{
    productSkuId: number;
    name: string;
    ordered: number;
    received: number;
  }>;
}) {
  const [state, formAction] = useActionState(receiveStockAction, INITIAL);
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(
      items.map((i) => [i.productSkuId, Math.max(0, i.ordered - i.received)]),
    ),
  );

  const total = Object.values(quantities).reduce((a, b) => a + b, 0);

  return (
    <Card
      title="Receive Products"
      desc="Enter the quantity arriving now. Serial numbers are comma-separated."
      bodyClassName=""
    >
      <form action={formAction}>
        <input type="hidden" name="purchase_id" value={purchaseId} />

        <div className="px-4 pt-4 sm:px-6">
          <FormAlert variant="error" message={state.error} />
          <FormAlert variant="success" message={state.success} />
        </div>

        <DataTable
          columns={[
            { label: 'Product' },
            { label: 'Ordered' },
            { label: 'Already received' },
            { label: 'Receive now' },
            { label: 'Serial numbers' },
          ]}
          isEmpty={items.length === 0}
        >
          {items.map((item) => (
            <Tr key={item.productSkuId}>
              <Td className="font-medium text-foreground">
                {item.name}
                <input type="hidden" name="product_sku_id" value={item.productSkuId} />
              </Td>
              <Td>{item.ordered}</Td>
              <Td>{item.received}</Td>
              <Td>
                <input
                  type="number"
                  name="quantity"
                  min="0"
                  max={item.ordered - item.received}
                  value={quantities[item.productSkuId] ?? 0}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.productSkuId]: Number(e.target.value),
                    }))
                  }
                  className="h-9 w-24 rounded-lg border border-border bg-transparent px-2 text-sm"
                />
              </Td>
              <Td>
                <input
                  type="text"
                  name="serial_no"
                  placeholder="SN1, SN2, ..."
                  className="h-9 w-48 rounded-lg border border-border bg-transparent px-2 text-sm"
                />
              </Td>
            </Tr>
          ))}
        </DataTable>

        <div className="p-4 sm:p-6">
          <SubmitButton disabled={total === 0}>Receive Stock</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
