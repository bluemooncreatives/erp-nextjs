# Laravel to Next.js migration status

Updated 2026-09-12. The overall migration is **not complete**. Do not run the final publication step on the basis of successful compilation alone.

## Recovered continuation point

The supplied transcript contains 19,254 lines. Its opening summary is older than the work recorded later in the attachment. Settings, localization, backup, profile, loans, transfers, opening balances, events, projects, contact self-service, sale/purchase/quotation edit and print views, and additional reports were added later. The actual stopping point was receipt vouchers, after adding `receiveFromAccounts()` and `receiveByAccounts()`.

## Completed in this continuation

- Receipt voucher list, create, and edit pages at the original `/account/voucher/recieve*` paths.
- Receipt invoice lookup for customer and retailer accounts, filtering unpaid sales and displaying the original payable-minus-payments calculation.
- Cash/bank account selection, bank documents, and server-side approval settings. Receipt edits retain the existing invoice reference, as in PHP.
- Shared voucher details page at `/account/voucher/detail/[id]/show`.
- Payment voucher edit page at `/account/voucher/payments/[id]/edit`, including existing posting lines and bank details.
- Payment creation now fixes its payment type on the server, obtains approval from business settings, and checks the current accounting period's start date.
- Journal and contra edit pages, links from their lists, and server-side checks for voucher type, permissions, line amounts, and balancing.
- Contra creation now supports one main account and multiple opposite-side lines, matching `ContraRepository`. It previously exposed only a two-account transfer.
- Preserved journal `array_unshift` ordering and contra `array_push` ordering, including deterministic transaction loading for editing.
- Contact login settings, CNF inline CRUD, stock product information with value totals, and leave carry-forward generation/toggling.
- Theme list/create/edit/clone/default/delete, image validation, palette persistence, and dashboard appearance. Restored original default background and missing-product image assets.
- System update information and version history. Installing legacy PHP update ZIP files is **not implemented**: those packages invoke Artisan and modify the PHP application. A compatible Next.js update mechanism remains outstanding.
- Bank-account editing and transaction history with opening balances; chart-account editing and list alias. Chart creation now inherits the parent type and code prefix, and editing rejects cyclic parent assignments.
- Expense and income editing with links from the lists. Income creation/editing now reproduces the PHP single posting, account choices, note/narration distinction, and approval setting rather than using the generic two-sided voucher form.
- Expense creation now uses the source approval setting and `contra_voucher` payment type. Its edit action retains the PHP controller's distinct `CRV` / debit behavior; this differs from creation and is covered by a regression test.
- Stock-transfer and stock-adjustment detail pages, list links, variant descriptions, stored totals, transfer documents, and adjustment printing.

The stock-transfer detail Blade references an undefined sale although the controller supplies a transfer. The new page displays the actual transfer fields. The adjustment Blade shifts creator/date labels and reads recovery money from the final line; the new page uses the corresponding adjustment fields. These are explicit source-template corrections, not new stock calculations.

Carry-forward calculations retain the original unusual scope: entitlement is not restricted to a year, and used leave includes applications whose start **or** end is in the previous year, without filtering approval status. Generation excludes user IDs 1 and 2, retains negative balances, and preserves the staff activation flag.

The original journal edit Blade uses `last()` even though its repository inserts the main leg first. The Next.js editor reads the stored main leg first for journals and last for contra vouchers so an edit preserves the posting structure. This source inconsistency is documented in `compound-edit.tsx`.

## Validation

- `npm test`: 29 tests passed. Tests exercise voucher actions/posting builders, expense/income action inputs and income posting direction, theme persistence rules/style sanitization, and carry-forward generation/toggling with mocked database or persistence boundaries.
- `npm run build`: passed, including TypeScript and route generation.
- Targeted ESLint checks on changed voucher/accounting, settings, themes, leave, and inventory pages and libraries: passed.
- No live MySQL validation was performed. No MySQL/MariaDB service or client was found by the local service/command check. These tests do not establish SQL, browser, or end-to-end production parity.

## Remaining work

`node scripts/audit-pages.mjs` performs a structural route check. The current app has 171 page files and 90 sidebar links. All sidebar links match pages. This establishes route presence only; the system updater is one concrete example of an incomplete workflow behind an existing page.

The audit also reports standalone screen candidates for manual review. Some Laravel routes are intentionally represented by inline forms or Server Actions; absence of a page alone is not proof of a missing feature. Prioritize inventory edits, product and contact details, import/export and PDF workflows, and payment gateways. Compare each with its controller, repository, request validation, and Blade view before implementing.

The original source references a Packing module that is not present. Do not invent its business logic. Legacy PHP system update packages still need explicit mapping to the new runtime rather than a success placeholder.

Continue auditing behavior as well as routes: the inherited payment voucher actions still need the Laravel notification side effects checked, and a database-backed test pass is necessary for balances, posting replacement, bank-document changes, and invoice references.

Inventory inspection also found existing differences requiring a dedicated pass: transfer receiving checks net rather than gross quantity, creates a new movement instead of updating the source purchase history, and changes approval status although PHP only stamps receipt. Transfer update must preserve existing item identity and distinguish added items; the source contains a sender-type typo. Validate receive/approve replay and concurrent operations against real stock data before calling these workflows complete. Bank/chart request-validation parity and expense-account option scope also remain to audit.

The user's final Git publication sequence remains contingent on completing the migration. No push was performed in this continuation.
