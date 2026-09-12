// ---------------------------------------------------------------------------
// Polymorphic ("morph") type map.
//
// The PHP stack stored Eloquent's fully-qualified class name in every
// `*able_type` column (saleable_type, houseable_type, productable_type, ...).
// The existing production database is full of those strings, so this app keeps
// writing and reading the exact same values rather than inventing new ones.
//
// Columns using this map:
//   adjustable_type  contactable_type  costable_type     houseable_type
//   itemable_type    notifiable_type   payable_type      productable_type
//   purchasable_type quotationable_type receivable_type  referable_type
//   saleable_type    sendable_type     storeable_type    voucherable_type
// ---------------------------------------------------------------------------

/** Every Eloquent class name that appears in a `*able_type` column. */
export const MorphType = {
  User: 'App\\User',
  Staff: 'App\\Staff',

  Sale: 'Modules\\Sale\\Entities\\Sale',
  Payment: 'Modules\\Sale\\Entities\\Payment',

  PurchaseOrder: 'Modules\\Purchase\\Entities\\PurchaseOrder',
  Purchase: 'Modules\\Purchase\\Entities\\Purchase',
  ProductItemDetail: 'Modules\\Purchase\\Entities\\ProductItemDetail',
  CostOfGoodHistory: 'Modules\\Purchase\\Entities\\CostOfGoodHistory',
  ReceiveProduct: 'Modules\\Purchase\\Entities\\ReceiveProduct',

  ShowRoom: 'Modules\\Inventory\\Entities\\ShowRoom',
  WareHouse: 'Modules\\Inventory\\Entities\\WareHouse',
  StockTransfer: 'Modules\\Inventory\\Entities\\StockTransfer',
  StockAdjustment: 'Modules\\Inventory\\Entities\\StockAdjustment',
  StockReport: 'Modules\\Inventory\\Entities\\StockReport',
  Expense: 'Modules\\Inventory\\Entities\\Expense',

  ProductSku: 'Modules\\Product\\Entities\\ProductSku',
  ComboProduct: 'Modules\\Product\\Entities\\ComboProduct',
  Product: 'Modules\\Product\\Entities\\Product',
  ProductHistory: 'Modules\\Product\\Entities\\ProductHistory',

  ContactModel: 'Modules\\Contact\\Entities\\ContactModel',

  Quotation: 'Modules\\Quotation\\Entities\\Quotation',

  Voucher: 'Modules\\Account\\Entities\\Voucher',
  Income: 'Modules\\Account\\Entities\\Income',
  BankAccount: 'Modules\\Account\\Entities\\BankAccount',
  ChartAccount: 'Modules\\Account\\Entities\\ChartAccount',
  OpeningBalanceHistory: 'Modules\\Account\\Entities\\OpeningBalanceHistory',

  Tax: 'Modules\\Setup\\Entities\\Tax',
  ApplyLoan: 'Modules\\Setup\\Entities\\ApplyLoan',

  Payroll: 'Modules\\Payroll\\Entities\\Payroll',

  Event: 'Modules\\Attendance\\Entities\\Event',
  Holiday: 'Modules\\Attendance\\Entities\\Holiday',

  Upload: 'Modules\\Project\\Entities\\Upload\\Upload',
  Tag: 'Modules\\Project\\Entities\\Tag',
  FieldOption: 'Modules\\Project\\Entities\\FieldOption',
  Project: 'Modules\\Project\\Entities\\Project',
  Task: 'Modules\\Project\\Entities\\Task',
} as const;

export type MorphTypeName = keyof typeof MorphType;
export type MorphTypeValue = (typeof MorphType)[MorphTypeName];

/** Reverse lookup: `'Modules\\Sale\\Entities\\Sale'` -> `'Sale'`. */
const REVERSE = Object.fromEntries(
  Object.entries(MorphType).map(([k, v]) => [v, k as MorphTypeName]),
) as Record<string, MorphTypeName>;

export function morphName(value: string | null | undefined): MorphTypeName | null {
  if (!value) return null;
  return REVERSE[value] ?? null;
}

/**
 * Stock lives against either a branch (ShowRoom) or a WareHouse. The PHP code
 * passed these around as a `houseable_type` string plus an id; this pairs them.
 */
export type HouseRef = {
  id: number;
  type: typeof MorphType.ShowRoom | typeof MorphType.WareHouse;
};

export function houseRef(id: number, kind: 'showroom' | 'warehouse'): HouseRef {
  return {
    id,
    type: kind === 'showroom' ? MorphType.ShowRoom : MorphType.WareHouse,
  };
}

/** `productable_type` is always one of these two in the PHP app. */
export type ProductableType =
  | typeof MorphType.ProductSku
  | typeof MorphType.ComboProduct;

/** A line item belongs to a Sale, PurchaseOrder or Quotation (`itemable_type`). */
export type ItemableType =
  | typeof MorphType.Sale
  | typeof MorphType.PurchaseOrder
  | typeof MorphType.Quotation
  | typeof MorphType.StockAdjustment
  | typeof MorphType.StockTransfer;
