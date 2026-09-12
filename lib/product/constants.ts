// Product constants shared by server code and client forms.
//
// Kept out of lib/product/products.ts because that module is `server-only`
// (it opens the MySQL pool) and the product form is a client component.

export const ProductType = {
  Single: 'Single',
  Variable: 'Variable',
  Service: 'Service',
  Combo: 'Combo',
} as const;

export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];
