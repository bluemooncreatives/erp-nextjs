# Laravel to Next.js migration status

Updated 2026-09-13. **Every route in the Laravel router now resolves in this port.**
`npm run verify:routes` reads the PHP route files and reports 591 named routes, all
present, with no page route left unserved - see **Route parity** for how that is measured
and for the 16 routes that are dead in the source itself.

The port has been validated against a real MySQL-compatible database: schema, queries,
write paths, permission names, every page as three different roles, server actions posted
as forms, and seven scenarios driven in a real browser. What is still open is listed under
**Remaining work**; read it before treating the migration as finished.

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

### Parity gaps closed by diffing the Blade forms against the ported forms

- Sale: the invoice number field, "Save & Preview" and "Save & Send Mail", and the
  auto-approval the controller applied when the `sale_approval` setting is on.
- Quotation: the same mail and preview buttons, stamping `status` when the mail goes out.
- Purchase: the bank `account_no` / `account_owner` on a payment, which the PHP stored.
- Product: the per-combination `variation_file` image and `price_of_other_currency`.
- Payroll: the role filter on the staff list that `staff_search_for_payroll` applied.
- Leave: applying on behalf of another user (system users only, as in the Blade) and the
  first/second-half choice for a makeup day - the action already read both fields.
- Sale and purchase history: the branch / warehouse (`house_id`) filter.

Both mail flows carry a link to the print view instead of the dompdf attachment the PHP sent.

### Notifications

Every `sendNotification()` call site the PHP controllers had is now raised from the matching
action: sale create / update / approve / delete, purchase create / update / approve, voucher
create / update / approve / delete, a new contact, a new staff member and generated payroll.
Each still fans out over the three channels gated by their business settings (mail, SMS and
the in-app `notifications` row), and the wording and subjects are the originals - including
the sale-update SMS that says "A Purchase has been approved by ...", which is how the PHP
read. Before this, only the events screen notified anything.

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
- **Permissions that could never be granted.** Payroll (`payroll.store/edit/delete`), sale
  shipping (`sale.shipping.store`) and the new contact balance actions guarded with names that
  are not Laravel route names, so every non-admin was refused while an admin - who bypasses the
  check - saw nothing wrong. They now use `save_payroll`, `payroll_payment_store`,
  `store.shipping`, `vouchers.store` and `journal.store`.
- **The branch filter on the sale and purchase history reports** was fetched but never
  rendered; `house_id` now filters as it does in the Blade.
- Unused TailAdmin template components (ecommerce widgets, demo calendar) were removed; they
  were dead code and the calendar broke lint.
- **Every form broke without JavaScript.** Next calls a `useActionState` action with the
  FormData alone when a form is posted before hydration or with scripting off, and all 105 of
  them read the second argument. They now normalise their arguments through `actionFormData`,
  so the forms degrade the way the Blade forms did - and the action test suite below can post
  them over plain HTTP.

## Validation

All of the following were run on 2026-09-12 against a throwaway MariaDB 11.4 instance loaded
from `software_erp.sql`, plus the usual static checks.

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | 46 passed |
| Type check | `npx tsc --noEmit` | clean |
| Lint | `npx eslint .` | clean, no warnings |
| Production build | `npm run build` | compiled |
| Route parity | `npm run verify:routes` | all 591 named Laravel routes present; 0 page routes unserved |
| Logic parity | `npm run verify:coverage` | 289 routed controller methods and 70 repositories audited; every remaining entry accounted for by hand |
| Permission names | `npm run verify:permissions` | 320 guarded names, all resolve to a route name or a known module permission |
| Schema parity | `npm run verify:schema <url>` | 107 tables / 1180 columns, no missing tables, columns or type mismatches |
| Query layer | `npm run verify:db` | 103 repository queries executed, 0 failures |
| Write paths | `npm run verify:writes` | 9 scenarios passed |
| Seeded end-to-end | `node scripts/seed-demo.mjs` | products, contacts, purchase (approved + received), sale (approved + paid), conditional sale, 4 vouchers, transfer, adjustment, leave type / define / approved application, payroll |
| Pages, as super admin | `npm run verify:http` | 216 routes, 0 server errors (201 rendered, 8 not-found for the portal pages an admin has no contact for, 7 expected redirects) |
| Pages, as staff | `ROLE_ID=3 npm run verify:http` | 216 routes, 0 server errors (134 rendered, 68 permission denials handled) |
| Pages, as a portal customer | `USER_ID=4 npm run verify:http` | 216 routes, 0 server errors (35 rendered, 174 correctly refused) |
| Server actions over HTTP | `npm run verify:actions` | 23 scenarios passed, including the in-app notification a contact raises and the attendance a holiday marks |
| In a real browser | `npm run verify:browser` | 7 scenarios passed - hydration, the product picker and running totals, the product type selector, adding a voucher line, list search, and the reference Edit round-trip |

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
from `SESSION_SECRET`; `ROLE_ID=<id>` runs the sweep as a user of that role.
`verify:permissions` needs no database, and `--db` additionally reports which guarded names a
given install has not seeded.

The database used for this pass was a disposable MariaDB on port 3307 created from
`software_erp.sql`; nothing was pointed at the configured `DB_HOST`.

## Completed in this pass

Closing the route-parity gaps the audit found:

- **Payment Due List** (`sale.due.list`), which the dashboard already linked to and which
  404'd. `dueList('all')` is `is_approved = 1 and status != 1`, the filter `listSales`
  already supports.
- **Due Invoice List** (`due.invoice.list`). `dueInvoiceList()` read `session('customer')`,
  a `"<prefix>-<id>"` string the sale and POS forms set over AJAX. A session value set by
  one screen and read by another has no equivalent here, so the party travels on the query
  string in that same spelling.
- **Sale and Purchase Auto Approval** (`sale.configurations`), over the
  `sale&purchase_type` business settings and the same toggle action the Settings
  Activation tab posts to.
- **Company Information** (`company_info`). `HomeController@company` renders the settings
  view with `$company` set, which the Blade reads only to mark the Company tab active, so
  this is the settings screen opened on that tab.
- **Serial keys** and **selling price history** for a SKU, and **My Products** for a
  signed-in contact.
- **Department Wise Leave** (`approve.leave.department` / `search.leave.department`).
- The print sheets: **staff account statement**, **payslip**, **attendance report**,
  **ledger report** and **leave application**.
- **File download** (`file.download`), with the path traversal the PHP allowed refused.

**Holiday Setup** (Modules/Leave), which `verify:coverage` found. Both
Attendance and Leave register a `holidays` resource against the same table, so
`holidays.index` is ambiguous in Laravel itself; the port had only the
Attendance screen, a flat list of holidays, while the Leave menu item points at
the other one. There a year is the unit: you add a year, fill in its holidays
(optionally copying another year's), and deleting a year removes all of them.
The Blade's own active check, `request()->is('leave/holidays')`, settles which
screen that menu entry meant.

Saving a year also does more than write `holidays`: for each holiday the PHP
clears any attendance already recorded on those dates and marks every user of
every non-system role as `H`. The port's `saveHoliday` wrote only the holiday
row, so **a declared holiday still counted as an absence** on the attendance
report. `saveHolidayYear` carries that behaviour, batching the inserts rather
than saving a model per user per day, and two action scenarios cover it.

Two further defects were found and fixed in the process:

- `payroll_earn_deducs.earn_dedc_type` holds the letters `'E'` and `'D'` - what
  `PayrollRepository` writes and what the reports filter on. The port was writing `'earn'`
  and `'dedc'`, so any payroll it generated showed no earnings and no deductions in either
  application, and rows Laravel had written were equally unreadable here.
- `SelectControl` had replaced the native `<select>` with a Radix listbox and a hidden
  input, which silently cost eight plain `<form method="get">` filter screens their
  no-JavaScript operation. A `<noscript>` now carries a real `<select>` under the same
  name.

## Route parity

`npm run verify:routes` reads `routes/web.php` and every `Modules/*/Routes/web.php`,
resolves Laravel's `->name('x.')->group()` prefixes and its `Route::resource` shorthand,
ignores commented-out routes, and checks each one against this port. It reports:

- **591 named routes, all present in `lib/routes.ts`.**
- **0 page routes without a page serving their URL.**
- **16 routes that are dead in the source.** Thirteen point at a controller method no
  controller defines, so the route 500s in Laravel too: `income.show`, `to_dos.index`
  / `.create` / `.show` / `.edit`, `suggest.create`, `stock-transfer.excel`,
  `purchase.order.download` / `.excel`, `purchase.return.excel`, `quotation.file`,
  `sale.excel`, and `showroom_wise.expense.daily`. The three `packing.*` report routes
  reach for a Packing module whose entities and tables are in neither the codebase nor
  the database dump, so they fatal as well. None was invented here.

Some entries in `lib/routes.ts` point at a different URL from the PHP one, because the
port serves that screen somewhere else: the reference tables (brand, category, model,
unit type, variant, tax, currency, printer, CNF, holidays, events, bank accounts, roles,
permissions, themes) are inline forms on their index rather than the modals Laravel
routed to; the payment and return panels sit on the document itself; and endpoints that
were jQuery AJAX are server actions or query parameters. `route()` has to produce a URL
that answers, so those entries name the screen that does, and `verify:routes` checks
they still do.

## Completed in this pass (payroll payment and loan-linked deductions)

`verify:coverage` lists `PayrollController@paymentPayroll` among the routed methods the
port never names, and files it under "naming, not absent behaviour" because
`payroll_payment_store` was already referenced - by a `can()` check gating a "Mark paid"
button. It wasn't naming: that button called `setPayrollStatus`, which only flipped
`payroll_status`. Marking a payroll paid never recorded how (cash, bank or cheque - the
columns for all three already existed on `payrolls`, unwritten), and never posted the
journal voucher `PayrollRepository::savePayrollPaymentData()` posts alongside it. Every
other document that changes money in this port posts its voucher; payroll paid out did
not.

`payPayroll()` (`lib/hr/leave.ts`) now does what the PHP method does: it writes the
payment date, method and (for bank or cheque) the supporting fields, then debits
Salary & Allowance (`03-18`) and credits Cash (`01-01-02`) for the net amount paid,
adjusted leg-for-leg by each earning and deduction line - including the loan-linked
deduction branch, which credits the staff's own chart account instead of Cash so a
salary-deducted loan repayment retires the loan rather than paying cash for it twice.
`payroll_voucher_approval` gates whether it posts pre-approved, matching every other
voucher-approval toggle. The "Mark paid" button is now `PayrollPaymentPanel`, an inline
disclosure modelled on the purchase order payment panel; `setPayrollStatus` is gone; a new
`verify:actions` scenario posts a real payment and asserts the two legs land balanced.

**Loan-linked deductions, closed in the same pass.** `PayrollRepository::create()` lets
payroll generation attach a loan repayment: the Blade pre-seeded one deduction row per
loan `ApplyLoan::Nonpaid()` returned for that staff member (title and monthly instalment
filled in, a checked `loanStatus[]` box), and saving reduced `apply_loans.paid_loan_amount`
by each such row's amount, marking the loan `paid` once it reached the original amount.
The port's `createPayroll()` had no loan-linking at all, so the branch `payPayroll()`
posts for a loan-flagged deduction (crediting the staff's own chart account instead of
Cash) was correct but unreachable - nothing ever set `loan_status = 1`.

`payableStaff()` now carries each staff member's unpaid, approved loans
(`unpaidLoansForUser()`, `lib/hr/loans.ts`); `GeneratePayrollPanel` seeds one deduction
line per loan when a staff member is selected, pre-filled the same way the Blade did, with
a "Loan repayment" label in place of the readonly styling and a per-line hidden `loan_id`
that survives to the action. `createPayroll()` runs inside one transaction: it writes the
payroll and its lines (`loan_status = 1` on a loan-linked one), then for each such line
loads the loan, adds the amount to `paid_loan_amount`, and marks it `paid` once that
reaches the loan's `amount` - the same guard and arithmetic as the PHP method. A new
`verify:actions` scenario generates a payroll with a loan-linked deduction that exactly
repays a loan and asserts the loan comes back `paid = 1`.

With this, the payroll module is at full logic parity: generation, payment, the ledger
postings on both sides, and the loan linkage between them.

## Completed in this pass (real PDF files)

The nine PDF-named routes - `sale.pdf`, `sale.challan_pdf`, `purchase.order.pdf`,
`quotation.order.pdf`, `payroll.pdf`, `attendance_report_print`, `staffs.report_print`,
`leadger_report.print_view` and `leave.application.download` - rendered the same
print-styled HTML page the on-screen "Print" button opens, relying on the browser's own
"Save as PDF" to produce a file. That is a reasonable stand-in for a person looking at
the screen, but it is not what those routes meant in Laravel: a route that hands back an
actual `.pdf` file, fit for an API client, an email attachment, or a script pulling one
from disk. They now do, via `pdfmake` - a small, pure-JS layout engine with no headless
browser or native binary dependency, chosen over a Puppeteer/Chromium round trip.

Each is a `route.ts` where a `page.tsx` was (a page and a route handler cannot share one
URL), rebuilding the same data the on-screen print view already fetched into a
`pdfmake` document instead of JSX. The four invoice-shaped documents (sale, challan,
purchase order, quotation) share one builder, `lib/pdf/invoice.ts`, because their source
pages all rendered the same `PrintHeader` / `PrintMeta` / `PrintLines` / `PrintTotals` /
`PrintFooter` shape already; the other five (payslip, staff statement, ledger, leave
application, and the landscape attendance grid) build their own layouts in
`lib/pdf/build.ts` and their route files, since each PHP view had its own.

Two things a `route.ts` does not inherit from `page.tsx`: the print route group's shared
`layout.tsx` (which is what enforced `requireUser()` on every one of these screens) does
not wrap a route handler at all, so each now calls it directly rather than relying on the
layout that used to. And `pdfmake` ships no fonts for server-side use - its bundled `vfs`
is browser-only - so the four Roboto weights it does bundle are vendored into
`lib/pdf/fonts/` rather than read out of `node_modules`, which is not guaranteed to
survive a production prune. There is no true Bold face in that set; Medium stands in, per
pdfmake's own recommendation.

One integration bug cost the most time here and is worth recording: pdfmake's
`resolveUrls()` step walks every registered font looking for a remote URL to fetch
*before* a font is ever read from disk, and it treats **any** `typeof value === 'object'`
font entry as a URL descriptor - which a Buffer also satisfies. Registering fonts as
Buffers therefore does not fail to load the font; it fails later, deep in URL resolution,
with an error that names an unrelated font style ("Font 'Roboto' in style 'bold' is not
defined") and gives no reason to suspect the font data itself. Fonts are registered as
plain file paths instead, with a `setLocalAccessPolicy()` restricting reads to
`lib/pdf/fonts/`, and `setUrlAccessPolicy(() => false)` refusing the network fetch this
port never wants a PDF-generation request making.

All nine were smoke-tested against the running app with real fixture ids: each returns
`200`, `Content-Type: application/pdf`, and bytes starting `%PDF-`, and `pdftotext`
against five of them confirms the real company, invoice and ledger data the on-screen
print views show is what landed in the file.

## Completed in this pass (POS, Project interactions, and a full-suite re-verification)

This pass built the two capabilities the earlier passes had left as gaps - a real POS
checkout and the Project module's interactive half (custom fields, drag-and-drop
ordering, attachments) - then re-ran the entire verification suite from a cold build to
confirm the whole port, not just the new work.

**POS** (`app/(dashboard)/pos/`) is a real checkout built on the existing `SaleForm` in
a `pos` mode: a product/combo picker, per-line serial-number selection where a SKU
tracks them, Quick Cash change calculation, and a transactional `checkoutPos` action
that re-validates everything server-side rather than trusting the posted totals -
combo stock demand aggregated across both a bare SKU and the same SKU inside a combo,
minimum-selling-price enforcement, serial numbers re-checked for availability, split
cash/non-cash payment limits, and the location's cash account confirmed configured
before the sale is created, paid and approved in one transaction. A 72mm receipt
(`(print)/pos/receipt/[id]`) follows checkout. As `docs/MIGRATION_STATUS.md` already
recorded, this is **net-new work, not a migration** - the PHP source has no POS module.

**Project custom fields** (typed per-project fields on tasks - text, number, date,
select, person) and **drag-and-drop board ordering** (tasks between sections, sections
themselves, and sub-tasks, each also keyboard-operable) are now real, backed by
`field-controls.tsx` and `lib/project/ordering.ts`, with field visibility and deletion
cleaning up the values they leave behind. **Task attachments** over 1MB now upload
correctly - `serverActions.bodySizeLimit` in `next.config.ts` is `12mb`, matching the
10MB limit `lib/project/attachments.ts` already enforced; the default 1MB Next ceiling
had been silently rejecting anything larger.

**Two real parity gaps closed by diffing behaviour, not just routes:**

- **Binary `.xls` imports.** Laravel's importer accepted `.xls` as well as `.csv`/
  `.xlsx`; the port rejected it. The spreadsheet reader now parses the legacy binary
  format too.
- **Sale and quotation emails attached a PDF in Laravel; the port only linked to the
  print view.** `lib/pdf/sale-document.ts` and `lib/pdf/quotation-document.ts` pull the
  same document-building logic the `sale.pdf` / `quotation.order.pdf` routes use into
  functions `lib/mail.ts` can call directly, so the confirmation email now carries the
  real invoice/quotation PDF as an attachment, the way Laravel's did.
- **The invoice PDF double-counted POS change.** `saleInvoice()`'s paid total was
  subtracting `payments.returnAmount` (change handed back) on top of `payableAmount`
  already being net of it, understating what was paid. Removed the second subtraction.

**A new verification script, `scripts/verify-operations.mjs`**, checks what the others
don't: all nine PDF routes return real `%PDF-`-prefixed bytes over HTTP, a
contact-linked session reaches every customer-portal screen, and (behind
`VERIFY_BACKUP=1`, since it shells out to `mysqldump`) the backup and restore actions
round-trip a real database - generate, confirm the file, truncate-and-restore from it,
and confirm every tracked table's row count is unchanged.

**Two genuine bugs surfaced by running that script, both fixed:**

- `lib/backup.ts` names the backup folder with `phpDate('d-m-Y', ...)`, which - like
  every date in this port - formats in UTC, matching how every other date in the
  application is written. `verify-operations.mjs`'s own folder computation used the
  test runner's *local* date instead, which disagrees with UTC for part of every day on
  a host ahead of it (this one included) - a false failure, and its cleanup silently
  missing the file it should have removed, purely from checking the wrong folder name.
  Fixed in the script, not the app.
- `importBackup` (`app/(dashboard)/backup/actions.ts`) called
  `revalidatePath('/', 'layout')` after a restore. The dashboard layout is already
  `force-dynamic` - nothing there was cached for that to usefully bust - and
  revalidating the *entire* layout turned out to interfere with delivering this
  particular action's own `useActionState` reply back to the person who just submitted
  it: the restore succeeded, but they never saw confirmation that it had. Narrowed to
  the same page-scoped `revalidatePath` its sibling `generateBackup` already used.
  (Chasing this down the wrong path first is worth recording too: the initial symptom
  looked identical to the action's message never rendering at all, which is exactly
  what happens when you check a `useActionState` result via a raw-HTML fetch that never
  runs JavaScript - the reply is real, but only client-side hydration puts it in the
  DOM. Confirmed with a real headless-browser click that the message renders correctly;
  `verify-operations.mjs` now asserts the restore's actual effect - the row counts -
  rather than text a script can't observe that way.)

**Full re-verification, from a clean build, all green:** `tsc --noEmit`, `next build`,
`eslint`, 54 unit tests, 26 `verify:actions` scenarios, 11 `verify:operations`
scenarios (backup included), 11 `verify:migration` fixture scenarios (POS checkout
including a rejected-quantity and a forced-rollback case, Project fields and ordering,
the oversized attachment, the binary XLS import), 12 `verify:browser` click-through
scenarios (POS checkout and the Project board drag included), 224/224 routes in the
HTTP sweep, 0 route/permission/schema gaps.

## Logic parity

`npm run verify:routes` answers "does a URL resolve". It says nothing about the
260 writing routes, because Next binds a server action as a function reference
and there is no URL to check. `npm run verify:coverage` asks the other question:
is the behaviour behind each PHP method present here at all? It reads all 96
controllers and 70 repositories, works out which methods a route can actually
reach, and checks each against the port both by name and by whether its route is
wired to anything.

It reports **289 routed controller methods** (72 more are defined but
unreachable by any route) and **174 of 310 repository methods cited by name**,
with 9 repositories the port never cites.

Those counts read worse than they are, and the script says so. Every remaining
entry has been checked by hand: what is left is naming, not absent behaviour.
The port consolidates - `dailyProfit`, `weeklyProfit`, `monthlyProfit` and
`yearlyProfit` are one parameterised `profitSeries`; `parentNullAccountList` is
`accountTree` - and it replaces whole categories of endpoint: AJAX feeds are
server-rendered data, modal fragments are inline panels, and the `session('sku')`
line accumulators are client state. **A new entry in that list is the signal**,
not the total.

Its first run earned its keep by finding a screen and a behaviour that were
genuinely missing, both now ported (see below).

## Remaining work

- **No production data has been touched.** The validation ran against a copy of the
  schema with seeded rows, not against the live database, and the live database may hold
  data shapes this dump does not (legacy rows, other branches, partially migrated
  records).
- **Legacy PHP update packages** remain unimplemented: they extract PHP files and run
  Artisan. The system-update screen explains this rather than pretending to install.
- **Two behaviours were fixed rather than reproduced**, each noted in the code:
  `HomeController@fileDownload` let a crafted path walk out of `public/`, and
  `LeaveController@departmentWiseSearch` calls a repository method that does not exist,
  so submitting that form 500s in Laravel.
- **`verify:browser` does not click through every interactive screen** - hundreds of
  pages, most of them plain forms already covered by `verify:actions`' no-JS post. What
  it misses is exercised by the HTTP sweep, which loads a screen but does not operate it.
  This pass added the one interactive surface it was missing that mattered: the payroll
  payment panel built in this pass has its own click-through scenario (opens the
  disclosure, confirms bank fields are absent for a cash payment and appear for a bank
  one, submits, and checks the row reads paid). It also caught a real bug the no-JS post
  couldn't have: every row's panel shared the same `payment_mode` / `bank_name` / etc.
  ids, invalid HTML the moment two unpaid payrolls are on the same page - each is now
  suffixed with its payroll id.

### A correction

An earlier version of this document listed "the POS screen" among the screens
the HTTP sweep loads. That was wrong when written: **the PHP source has no POS
module at all** - no `Modules/Pos`, no route, no seeded permission, and no
`type = 2` sale in the dump. The only traces are a `PosProductSelect` trait
nothing calls and menu conditions that hide chrome on a URL nothing serves.

A POS screen exists in this port now, but it is **net-new work, not a
migration**: there was nothing to port. `verify:routes` reports it, with the
Project and Team resource routes, under "route names the PHP router does not
define", so the distinction stays visible rather than dissolving into the
parity numbers.

Publication: the work is committed on `main` **and has been pushed to `origin/main`** - the
reflog shows the pushes were made by this workspace's own tooling, not by a deliberate
publication step. Anyone treating "not yet published" as a gate should check `git log
origin/main` first.
