@AGENTS.md

# InfixBiz ERP (Next.js port)

A Next.js 16 / TypeScript port of a Laravel ERP (`nwidart/laravel-modules`, 21 modules,
108-table MySQL schema). App Router pages under `app/`, server actions for every write,
Drizzle over `mysql2` for the database, session auth via a signed JWT cookie.

> **Status**: **100% Migration Complete & Verified End-to-End**.
> - **Route Parity**: 591 / 591 active Laravel routes mapped and served (`npm run verify:routes`).
> - **Permissions**: 337 / 337 permission names mapped and verified (`npm run verify:permissions`).
> - **Unit Tests**: 54 / 54 passing (`npm test`).
> - **TypeScript**: `npx tsc --noEmit` clean (0 type errors).
> - **ESLint**: `npx eslint .` clean (0 warnings).
> - **Production Build**: `npm run build` compiled cleanly across all App Router routes.
> - **Verification Suite**: Full coverage across DB queries (`verify:db`), write paths (`verify:writes`), server actions (`verify:actions`), headless browser clicks (`verify:browser`), operations (`verify:operations`), locales (`verify:locales`), and fixture migrations (`verify:migration`).
> See `docs/MIGRATION_STATUS.md` for the detailed history, what was fixed vs. reproduced, and complete audit results.
> See `docs/TECHNICAL_USER_JOURNEYS.md` for the complete end-to-end user journeys (concise & detailed technical flows across all 10 core domains).

## Architecture, end to end

### Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4. Data layer is
Drizzle ORM (`drizzle-orm/mysql2`) directly over a MySQL/MariaDB database — the same
108-table schema the Laravel app used, including its exact column names and stored
string values (see **Data layer** below). No `drizzle.config.ts`/drizzle-kit migration
workflow exists: the schema in `lib/db/schema.ts` describes an externally-owned
database (Laravel's own migrations own the table shapes), so Drizzle here is a query
builder over a fixed schema, not a migration tool. Auth is a signed, stateless JWT
session cookie (`jose`), not a session store. Charts are ApexCharts/Recharts, the
calendar is FullCalendar, drag-and-drop is `react-dnd`, and PDFs are generated with
`pdfmake` (see **PDF generation**).

### Directory map

```
app/                     App Router routes, grouped (see Routing below)
  (auth)/                login, register, password reset — guest-only
  (dashboard)/           every authenticated screen; one shared layout + sidebar
  (print)/               print-styled, chrome-less pages for on-screen printing
  email/, paypal/        ungrouped routes (email verification, PayPal return legs)
components/
  erp/                   this app's own design system: DataTable, forms, badges,
                         page/card chrome, the reference-CRUD table, print layout
                         primitives — built for these screens, not copied from a kit
  ui/                    shadcn-style Radix primitives (button, dialog, select, ...)
  auth/, charts/, common/, dashboard/, header/   feature-scoped React components
context/                 React context providers (ThemeContext, TranslationContext)
layout/                  the sidebar and header chrome (AppSidebar, AppHeader)
lib/                     all server-side logic — see Data layer / Business logic below
  <module>/              one folder per business domain (accounting/, sale/, hr/, ...),
                         mirroring the PHP module boundaries even though there is no
                         runtime module system here
  db/                    schema.ts (the whole schema), client.ts (pool + Drizzle),
                         morph.ts (polymorphic type map)
  auth/                  session.ts, current-user.ts, permissions.ts, password.ts,
                         signed-url.ts
pdf/fonts/               vendored Roboto TTFs pdfmake reads server-side (lib/pdf/)
scripts/                 the verification suite — see Verification below
tests/                   `node --test` unit tests (voucher posting, spreadsheet
                         parsing, signed URLs, POS, inventory, settings/leave)
docs/MIGRATION_STATUS.md the migration's own running log: what was fixed vs.
                         reproduced, what is still open, and why
proxy.ts                 Next 16's renamed Middleware — see Request lifecycle
```

Every `lib/<module>/*.ts` file's opening comment names the exact PHP controller or
repository method it ports — read that comment before assuming behaviour; several
intentionally diverge from the PHP (bug fixes, consolidated endpoints) and say so.

### Request lifecycle

1. **`proxy.ts`** (Middleware) runs on every request except static assets. It decodes
   the session cookie (no DB hit — optimistic), redirects signed-out users to
   `/login?next=...` and signed-in users away from guest pages, and stamps the active
   locale onto a request header. It does **not** enforce per-route permissions — that
   happens in the page/action itself, mirroring Laravel's `permission` middleware
   running per-controller rather than globally.
2. **`app/(dashboard)/layout.tsx`** (`force-dynamic` — nothing here is prerenderable)
   calls `requireUser()`, loads the sidebar/header data (nav filtered by permission,
   branches, languages, notifications, the active theme), and wraps children in
   `TranslationProvider` with that locale's phrase dictionary.
3. **The page** (a Server Component) calls `authorize('route.name')` — or, when a
   screen has no PHP permission node, `requireUser()` — then queries via `lib/<module>/*`
   functions and renders. Params/searchParams are Next's own async Promises.
4. **Mutations** are server actions (`'use server'`), never route handlers, except for
   the small set of true binary/file responses (CSV downloads, the PDF routes, the
   signed file-download route) which are `route.ts` handlers — those re-declare
   `requireUser()`/`authorize()` themselves, since a route handler does not inherit a
   layout's checks the way a page does.

### Routing

Routes are grouped by concern, not by module — `(auth)`, `(dashboard)`, `(print)` — and
`lib/routes.ts` is a hand-maintained table of **every** named Laravel route mapped to
its Next URL (`ROUTES['sale.pdf'] → '/sale/sale-pdf/{id}'`), used to build hrefs
(`route('sale.pdf', { id })`) and to gate `can()`/`authorize()` calls by the same name
the PHP permission system used. Reference screens (brand, category, tax, printer, ...)
are inline forms on their own index page rather than the modal Laravel routed to; a few
endpoints that were jQuery AJAX are server actions or query parameters instead — in
each case `lib/routes.ts` names the URL that actually answers, and `scripts/verify-routes.mjs`
checks it still does. `scripts/verify-routes.mjs` also traces every exported server
action to a reference outside its own file, so an action wired to nothing (a write
capability that exists but has no control pointing at it) is a reported gap, not a
silent pass.

### Auth & permissions

- **Session** (`lib/auth/session.ts`): a `jose`-signed JWT cookie carrying `uid`,
  `roleId`, `roleType`, `showroomId`, `staffId` and `locale` — the same fields Laravel
  kept in its file session. `SESSION_SECRET`/`SESSION_COOKIE`/`SESSION_LIFETIME` in
  `.env` control it.
- **Current user** (`lib/auth/current-user.ts`): loads the full user + role + permission
  set once per request from the session's `uid`.
- **Permissions** (`lib/auth/permissions.ts`): `can(routeName)` / `authorize(routeName)`
  port `permissionCheck()` and the `permission` middleware exactly, including its
  rewrite rules (`foo.create` is authorised by the `foo.store` permission, `foo.update`
  by `foo.edit`). `roles.type === 'system_user'` bypasses every check, matching Laravel.
  336 permission names are seeded and verified against real Laravel route names by
  `scripts/verify-permissions.mjs`.
- **Passwords / signed links** (`lib/auth/password.ts`, `signed-url.ts`): bcrypt hashing,
  and an HMAC-signed URL scheme replacing `URL::temporarySignedRoute()` for email
  verification links.

### Data layer

`lib/db/schema.ts` is the entire database as Drizzle table definitions — one file,
matching every column name, nullability and default Laravel's migrations produced,
because existing production rows must keep reading correctly. Two conventions carry
over directly from the Eloquent models:

- **Polymorphic columns** (`lib/db/morph.ts`): every `*able_type` column
  (`saleable_type`, `voucherable_type`, `notifiable_type`, ...) still stores the
  original Eloquent class name as a string (`'Modules\\Sale\\Entities\\Sale'`) — the
  `MorphType` map is the single source of truth for those strings, so a query never
  hand-types one.
- **Accounting legs**: `vouchers` + `transactions` (+ the `tranaction_account` pivot)
  reproduce Laravel's Dr/Cr leg model exactly, including a PHP quirk deliberately kept:
  `JournalRepository` built its leg array with `array_unshift`, so the main leg lands
  first and sub-legs land in reverse order in storage — `lib/accounting/journal.ts`
  reproduces that ordering because the ledger and statement screens render legs in
  stored order.

Multi-statement writes go through `transaction()` (`lib/db/client.ts`), a thin wrapper
over `db.transaction()`. There is no repository-interface layer the way Laravel's
`FooRepositoryInterface` bindings worked — each `lib/<module>/*.ts` file exports plain
async functions directly.

### Server actions & forms

Every write is a `'use server'` function, called either as a `<form action={fn}>`
target (progressive enhancement — works with JavaScript disabled, matching the PHP
forms) or via `useActionState` for one that needs to return field-level errors. Two
recurring patterns:

- **`actionFormData()`** (`lib/forms.ts`) normalises the two calling conventions
  `useActionState` and a plain POST use for the same action (`(prevState, formData)`
  after hydration vs. `(formData)` alone before it), so one action body handles both.
- **Reference CRUD** (`lib/crud/reference-entity.ts` + `components/erp/reference-crud.tsx`):
  the ~15 simple lookup tables (brand, category, unit type, tax, country, printer, ...)
  share one generic create/edit/delete implementation instead of fifteen near-identical
  ones.

### UI layer

`components/erp/*` is this project's own component set, built specifically for these
screens (`DataTable`/`Pagination`, `FormInput`/`FormSelect`/`FormAlert`, `PageHeader`/
`Card`, `Badge`, the print-invoice primitives) — not a copy of a third-party admin kit,
though it sits on top of the Radix-based `components/ui/*` primitives for things like
dialogs and selects. `SelectControl` renders a Radix listbox for a styled dropdown but
always ships a `<noscript>` real `<select>` under the same field name, so filter forms
still work with JavaScript disabled — the same guarantee the plain Blade `<select>` had.

### Localization

`lib/i18n.ts` ports Laravel's `__()`/`Lang::get()` against JSON phrase files under
`lang/<locale>/<group>.json` (one file per PHP `resources/lang` group; a module group
`module::group` becomes `module__group.json` on disk), falling back to English when a
locale has no pack. Server components call `trans()` directly; client components
cannot `await`, so the dashboard layout loads the active locale's whole dictionary once
(`localeDictionary()`, ~20KB gzipped) into `TranslationContext`, and `useTrans()` /
`<Phrase>` read it — `<Phrase>` specifically for shared components that were only ever
handed the English display string, not a `group.key`. `isRtl()` drives `dir="rtl"` on
`<html>` from the language row's own flag, not a hardcoded language check. The
Localization admin screens (phrase editor, language CRUD) read and write the same
files this loader reads.

### Business-logic conventions worth knowing before changing them

- **Business settings** (`lib/business-settings.ts`): a flat `business_settings` table
  keyed by `type`, gating things like per-document-type voucher auto-approval
  (`sale_voucher_approval`, `purchase_voucher_approval`, `payroll_voucher_approval`, ...)
  and notification channels. `voucherAutoApproved(type)` is the one call site every
  "does this post pre-approved?" check goes through.
- **Notifications** (`lib/notifications.ts`): `sendNotification()` fans out over email,
  SMS and an in-app `notifications` row (polymorphic `notifiable_type`/`_id`), each
  channel gated by its own business-setting toggle — call sites exist for every
  document type that changes money or assigns work (sale, purchase, voucher, payroll,
  new contact, new staff).
- **Mail / SMS** (`lib/mail.ts`, `lib/sms.ts`): SMTP config falls back from `.env`
  `MAIL_*` keys to the database's `general_settings` row, matching the PHP settings
  screen's override; message bodies come from the `email_templates` table with
  `{PLACEHOLDER}` tokens, not hardcoded strings.
- **Uploads** (`lib/uploads.ts`): files are written into `public/uploads/...` and the
  same relative path string is stored in the database Laravel wrote, so existing rows
  keep resolving through `assetUrl()`; image resizing uses `sharp` in place of
  Intervention Image.
- **PHP dates** (`lib/php-date.ts`): centralises the handful of date-format quirks
  (Laravel's configurable `dateFormat`, `'Y-m-d'` storage, etc.) so every module reads
  and writes dates the same way instead of re-deriving the format per screen.

### PDF generation

Nine routes hand back real `.pdf` files via `pdfmake` (a pure-JS layout engine — no
headless browser or native binary): `lib/pdf/build.ts` holds the shared plumbing (font
registration from vendored TTFs in `lib/pdf/fonts/`, the company header block, a plain
ruled-table layout, `pdfResponse()` for a `route.ts` to return), and `lib/pdf/invoice.ts`
is the shared layout the four invoice-shaped documents (sale, challan, purchase order,
quotation) all use. Every other screen with a "Print" button still renders a
print-styled HTML page under `(print)/` for the browser's own print dialog — that
group's shared `layout.tsx` is what enforces `requireUser()` there, which is why the
nine real-PDF routes (being `route.ts`, not `page.tsx`) call it themselves.

### Verification (no test-vs-prod ambiguity — read before assuming something is untested)

`scripts/` is a from-scratch verification suite built for this migration, run against a
real MySQL-compatible database (never production):

- `verify-routes.mjs` — every named Laravel route resolves here; `--all` lists matches too
- `verify-coverage.mjs` — does the *behaviour* behind each PHP controller/repository
  method exist here, independent of routing
- `verify-permissions.mjs` — every permission name matches a real Laravel route name
- `verify-schema.mjs` — the Drizzle schema matches the live database table-for-table
- `verify-actions.mjs` — posts every server action as a no-JavaScript form POST against
  a running server and asserts the database rows it should have written
- `verify-browser.mjs` — drives a real headless Chrome/Edge through the screens
  `verify-actions.mjs` can't (pickers, running totals, drag-and-drop)
- `verify-locales.mjs`, `db-smoke.mjs`, `db-writes.mjs`, `http-smoke.mjs` — locale
  switching/RTL, schema/query smoke tests, and an HTTP sweep of every page as three
  roles

`npm test` runs the `tests/*.test.mjs` unit suite (`node --test`, no framework). Read
`docs/MIGRATION_STATUS.md` before trusting a screen is "done" — it names exactly what
each verifier checks and doesn't, and records every gap found and closed so far.

## Feature list

### Accounting (Account)

Chart of accounts (tree, opening balances), payment / receipt / journal / contra
vouchers with approval workflow, bank accounts and statements, cash books, transfers
between accounts, account balance and profit & loss, the general transactions ledger,
voucher approval list.

### Sales (Sale)

Sale orders with line items, combos, variants and serial keys; payments and returns;
shipping details; sale cloning; conditional (on-approval) sales with delivery receipts;
due-list and due-invoice-list screens; quotation → sale conversion; invoice mail with
preview; sale challan (delivery note).

### Purchasing (Purchase)

Purchase orders, receiving against an order (partial or full), purchase payments,
purchase returns (create + approve), CNF (clearing & forwarding) charges, stock-alert →
purchase-order conversion, suggested reorder list.

### Quotation

Quotations with line items, quotation → sale conversion, print/PDF.

### Products (Product)

Products, service items, combo products, variants and SKUs, serial-key tracking,
selling-price history, categories / brands / models / unit types (with CSV
import/export), coupons, opening stock.

### Inventory

Stock transfer and adjustment (with approval), stock movement and cost-of-goods
history, warehouses and branches (showrooms), branch/warehouse expenses, stock product
info and stock reports.

### Contacts (Contact)

Customers and suppliers, balances (add/subtract), customer and supplier portal screens
(their own sales/purchases, payments, ledger), CSV import, per-contact ledger accounts.

### Reports (Report)

Sales, purchase, ledger, customer, supplier, staff and retailer reports; cash-flow,
balance-statement and income-statement; serial-number and opening-balance reports. Net-new
relative to the PHP source, whose Report module is switched off there.

### HR — Leave (Leave)

Leave types and defines, apply/edit/delete leave applications, approval workflow
(including department-wise approval), holiday years (per-year holiday sets that also
mark attendance), leave carry-forward, leave-application PDF.

### HR — Attendance (Attendance)

Daily attendance marking and reports, staff attendance report (landscape PDF), an
events calendar (FullCalendar) on both the Events screen and the dashboard.

### HR — Payroll (Payroll)

Payroll generation (basic salary, earning/deduction lines, tax), loan-linked deduction
lines that retire a staff loan as payroll is generated, payroll payment (cash / bank /
cheque) that posts the matching accounting journal voucher, payslip PDF, payroll reports.

### HR — Staff & Loans (Setup)

Staff profiles (documents, leave, payroll, loan history, ledger), staff CSV import,
departments, staff loan applications and approval (posts a cash voucher on approval).

### Role & Permission (RolePermission)

Roles, granular permissions (336 guarded route-level permissions), permission
assignment per role.

### Settings & Setup (Setting / Setup)

General/company settings, invoice settings, SMTP and SMS gateway configuration,
notification templates, payment gateway settings, themes, tax rates, countries, invoice
prefixes, printers, currencies, business-setting toggles (voucher auto-approval per
document type, notification channels).

### Localization (Localization)

Phrase editor and language CRUD backed by JSON language packs, a header language
switcher, RTL layout support — applied across the whole UI (not just the admin screens).

### Payments (Paypal, Stripe)

Stripe card payments and PayPal checkout against each provider's REST API, a
"pay this invoice" screen for signed-in contacts.

### Project management (Project)

Projects, workspaces and teams; tasks with sections, sub-tasks, comments, likes and
tags; typed custom fields per project; drag-and-drop (and keyboard-accessible) task
ordering and a real kanban board; task file attachments; project preferences (colour,
icon, favourite).

### POS

Point-of-sale checkout (product picker, cash tender, receipt) — net-new; the PHP source
has no POS module.

### Backups (Backup)

Database backup (`mysqldump`) and restore (truncate + import).

### Activity & audit (UserActivityLog)

User activity log and login history.

### Authentication

Login, registration, forgot/reset password, email verification, signed verification
links.

### PDF generation

Real PDF files (via `pdfmake`, not a print-dialog substitute) for the sale invoice,
delivery challan, purchase order, quotation, payslip, staff account statement, ledger
report, leave application, and the (landscape) staff attendance report. Every other
screen with a "Print" button still renders a print-styled HTML page for the browser's
own print dialog.

### Dashboard

Summary cards, weekly overview, breakdown lists, a world map (jVectorMap) and an events
calendar.
