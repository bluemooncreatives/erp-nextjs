# Laravel to Next.js migration status

Updated 2026-09-12. The port now covers every screen reachable from the sidebar plus the
secondary screens listed below, and it has been validated against a real MySQL-compatible
database for the first time. The remaining gaps are listed under **Remaining work**; read
that section before treating the migration as finished.

## What was completed earlier

Receipt, payment, journal and contra vouchers (create, edit, approval rules, posting order),
voucher details, expense and income editing, bank and chart account editing, themes, contact
login settings, CNF, stock product information, leave carry-forward, the system-update
screen, and stock transfer / adjustment editing with their detail pages. The detail of those
passes is in the git history; this document covers the state of the whole port.

## Completed in this continuation

### Product

- Combo products: the Combo tab on the product list (image, prices, item count, active
  toggle), the combo edit screen at `add_product.show` / `add_product.editCombo`, and the
  active-status action. The Blade disabled the picker on edit, and `ProductRepository::update()`
  only rewrites quantities of rows that already exist - that is preserved.
- Product / combo detail view at `add_product.product_Detail` (`/product/view?id=&type=`),
  including per-branch stock and variant rows.

### Contacts

- Customer and supplier detail screens (`add_contact.show`, `customer.view`, `supplier.view`)
  with profile, invoice / return / transaction tabs, and the finance summaries.
- "Add balance" and "Subtract balance", ported from `addBalanceCustomer`, `addBalanceSupplier`
  and `minusBalance`. Both subtract modals post an `account_type` that is not the string
  `'debit'` (the supplier one is the misspelled `'dedit'`), so `trranactionEntry()` takes the
  same branch either way; the port does the same and says so in the code.
- The customer/supplier "Products" screens (`customerSaleProductList`, `supplierPurchaseProductList`).
- "View" links on the contact lists, with the walk-in customer's Edit hidden as in the Blade.

### Import and export

- A spreadsheet reader (`lib/import/spreadsheet.ts`) that parses CSV and reads .xlsx directly
  (zip + XML), with no new dependency. Binary .xls is reported as unsupported rather than
  silently ignored - the PHP importer accepted it and this port does not.
- Upload screens and importers for products, contacts, brands, models, unit types, bank
  accounts and staff, matching each `csv_upload_*` repository method, plus the sample
  workbooks the Blade linked to.
- `csv_download` endpoints for brand, model and unit type.
- The bank-account importer reads `openning_balance` and ignores it, because the column is
  neither in `bank_accounts` nor in the model's `$fillable`: the PHP dropped it too, which
  makes `create_chart_account()` dead code there.
- PDF routes (`sale.pdf`, `sale.challan_pdf`, `purchase.order.pdf`, `quotation.order.pdf`)
  render the existing print sheet and open the browser's print dialog. dompdf has no
  equivalent here; "Save as PDF" produces the same document.

### Payments

- Stripe card page and charge (`stripe.index` / `stripe.process`) through Stripe's REST API,
  and the PayPal handoff and execute routes through PayPal's v1 payments API. The PHP kept
  the sale and amount in the session between redirect legs; they travel on the return URL.
- The customer's own "pay this invoice" screen (`contact.my_payment`) and the Pay links on
  My Details.

### Authentication

- Register, forgot-password, reset-password and email-verification screens - `Auth::routes()`
  generated these and only the login page existed.
- Signed verification links equivalent to `URL::temporarySignedRoute()`, and a proxy exception
  so a signed-in user can open the link they were mailed.

### Other screens

- Printer setup (`printer.index`), now in the Settings menu as in the PHP menu.
- Coupons (`coupon.index`): list and create only, because `CouponController` has no edit,
  update or destroy method even though routes point at them.
- Staff profile (`staffs.view` / `staffs.show`) with documents, leave, payroll, loans and the
  staff ledger.
- Branch details (`showroom.show`) with the opening-balance form.
- Sale on Condition (`conditional.sale.index`) with approval and the delivery-receipt action.
- Stock alert list can now convert the chosen SKUs into a prefilled purchase order, which is
  what `convertSuggest()` did.

### Fixes found by running the app

- **Reference screens returned 500.** `ReferenceCrud` took `extraFields` as a render function
  passed from server components; React refuses functions across that boundary, so Branch,
  Warehouse, Category, Variant, Currency, Country, Tax and Printer all failed at request time.
  Extra inputs are now declared as serializable specs, which also fixes Branch and Warehouse
  losing email/phone/address when editing.
- **Ledger report balances.** The running balance was accumulated inside an async `map`, so
  every row's formatted balance showed the closing balance. It is computed before formatting.
- **Bank ledger account code.** `createBankAccount` wrote `01-03-<id>`; the PHP writes
  `03-<id>`.
- Unused TailAdmin template components (ecommerce widgets, demo calendar) were removed; they
  were dead code and the calendar broke lint.

## Validation

All of the following were run on 2026-09-12 against a throwaway MariaDB 11.4 instance loaded
from `software_erp.sql`, plus the usual static checks.

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | 43 passed |
| Type check | `npx tsc --noEmit` | clean |
| Lint | `npx eslint app lib components scripts` | no errors (17 unused-symbol warnings) |
| Production build | `npm run build` | compiled |
| Schema parity | `npm run verify:schema <url>` | 107 tables / 1180 columns, no missing tables, columns or type mismatches |
| Query layer | `npm run verify:db` | 103 repository queries executed, 0 failures |
| Write paths | `npm run verify:writes` | 9 scenarios passed |
| Seeded end-to-end | `node scripts/seed-demo.mjs` | products, contacts, purchase (approved + received), sale (approved + paid), conditional sale, 4 vouchers, transfer, adjustment |
| Pages, as super admin | `npm run verify:http` | 202 routes, 0 server errors (177 rendered, 18 not-found for absent rows, 7 expected redirects) |
| Pages, as staff with no permissions | `ROLE_ID=3 npm run verify:http` | 202 routes, 0 server errors (135 permission denials handled, 51 rendered) |

The write scenarios assert the behaviour the PHP relied on: a receipt posts one Dr and one Cr
leg; editing a voucher **replaces** its transactions and its cheque document instead of
appending, and keeps the invoice reference; a journal writes the main leg first and balances;
deleting a voucher removes its transactions; account balances follow the posted legs; a stock
transfer moves stock only on receipt and a repeated receipt does not move it twice; a sale
payment is booked against the invoice; a new contact gets a ledger account coded
`0<type>-<parent>-<id>`; and the brand importer writes what it parsed.

### Running the validation locally

The scripts take the database from the usual `DB_*` environment variables:

```bash
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=software_erp \
  npm run verify:db
```

`verify:writes` and `seed-demo.mjs` write to the database they are pointed at - use a scratch
copy, never production. `verify:http` needs a running server and mints its own session cookie
from `SESSION_SECRET`.

## Remaining work

- **No production data has been touched.** The validation ran against a copy of the schema with
  seeded rows, not against the live database, and the live database may hold data shapes this
  dump does not (legacy rows, other branches, partially migrated records).
- **Server actions are only covered indirectly.** The HTTP sweep is GET-only; form submissions
  are exercised through the repository layer instead. A browser pass over the main forms
  (sale, purchase, vouchers, product) is still worth doing before cutover.
- **Legacy PHP update packages** remain unimplemented: they extract PHP files and run Artisan.
  The system-update screen explains this rather than pretending to install.
- **The Packing module referenced by the source is absent**, so `report/packing-report` has no
  implementation and none was invented.
- Routes that exist in the PHP router but have no controller method - `suggest.create`,
  `to_dos.*` beyond store/complete, `coupon.edit/update/destroy`, `income.show`,
  `apply_loans.show/edit` as pages - are intentionally not ported; they are dead in the source.
- Reference screens that the PHP served as modals (brand, category, model, unit type, variant,
  tax, country, currency, language, holiday, event, role, permission, CNF, printer) are inline
  forms here. That is a deliberate interface change, not a missing screen.
- Audit note: `node scripts/audit-pages.mjs` reports 203 page files and 92 sidebar links, with
  every sidebar link resolving. Its "missing screen candidates" list is structural only; each
  remaining entry is one of the dead or inline cases above.

The user's final Git publication step has not been taken: everything is committed on `main`
locally and nothing has been pushed.
