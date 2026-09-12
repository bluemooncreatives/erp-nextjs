'use client';

// ---------------------------------------------------------------------------
// Shared product-line picker for the inventory forms (stock transfer and stock
// adjustment), matching the repeating cart rows the Blade views used.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { FormSelect } from '@/components/erp/fields';
import { DataTable, Td, Tr } from '@/components/erp/table';

export type PickableProduct = {
  id: number;
  label: string;
  price: number;
  stock?: number;
};

export type PickedLine = {
  productId: number;
  label: string;
  price: number;
  quantity: number;
  stock?: number;
};

export function LinePicker({
  products,
  idFieldName,
  quantityFieldName,
  priceFieldName,
  currencySymbol,
  showPrice = true,
  error,
  initialLines = [],
}: {
  products: PickableProduct[];
  /** Form field names, matching what the server action reads. */
  idFieldName: string;
  quantityFieldName: string;
  priceFieldName?: string;
  currencySymbol: string;
  showPrice?: boolean;
  error?: string;
  initialLines?: PickedLine[];
}) {
  const [lines, setLines] = useState<PickedLine[]>(initialLines);

  const addLine = (value: string) => {
    const product = products.find((p) => String(p.id) === value);
    if (!product) return;

    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          label: product.label,
          price: product.price,
          quantity: 1,
          stock: product.stock,
        },
      ];
    });
  };

  const patch = (productId: number, patchValue: Partial<PickedLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, ...patchValue } : l)),
    );

  const columns = [
    { label: 'Product' },
    ...(showPrice ? [{ label: 'Unit price' }] : []),
    { label: 'Quantity' },
    ...(showPrice ? [{ label: 'Subtotal' }] : []),
    { label: '' },
  ];

  return (
    <>
      <div className="mb-4 max-w-md">
        <FormSelect
          label="Add product"
          name="_picker"
          value=""
          onChange={(e) => addLine(e.target.value)}
          placeholder="Search and select a product"
          options={products.map((p) => ({
            value: p.id,
            label:
              p.stock != null ? `${p.label} (stock ${p.stock})` : p.label,
          }))}
        />
      </div>

      {error ? <p className="mb-3 text-xs text-error-500">{error}</p> : null}

      <DataTable columns={columns} isEmpty={lines.length === 0} empty="No products added yet.">
        {lines.map((line) => (
          <Tr key={line.productId}>
            <Td className="font-medium text-gray-700 dark:text-gray-300">
              {line.label}
              <input type="hidden" name={idFieldName} value={line.productId} />
            </Td>

            {showPrice ? (
              <Td>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name={priceFieldName}
                  value={line.price}
                  onChange={(e) =>
                    patch(line.productId, { price: Number(e.target.value) })
                  }
                  className="h-9 w-28 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </Td>
            ) : null}

            <Td>
              <input
                type="number"
                min="1"
                max={line.stock}
                name={quantityFieldName}
                value={line.quantity}
                onChange={(e) =>
                  patch(line.productId, { quantity: Number(e.target.value) })
                }
                className="h-9 w-24 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              {line.stock != null && line.quantity > line.stock ? (
                <p className="mt-1 text-theme-xs text-error-500">
                  Only {line.stock} in stock
                </p>
              ) : null}
            </Td>

            {showPrice ? (
              <Td className="font-medium">
                {`${currencySymbol} ${(line.price * line.quantity).toFixed(2)}`}
              </Td>
            ) : null}

            <Td>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => prev.filter((l) => l.productId !== line.productId))
                }
                className="rounded-lg px-2 py-1 text-theme-xs font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
              >
                Remove
              </button>
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
