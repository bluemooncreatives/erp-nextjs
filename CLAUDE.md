@AGENTS.md

# InfixBiz ERP (Next.js port)

A Next.js/TypeScript port of a Laravel ERP (`nwidart/laravel-modules`, 21 modules,
108-table MySQL schema). App Router pages under `app/`, server actions for every write,
Drizzle over `mysql2` for the database, session auth via a signed JWT cookie. See
`docs/MIGRATION_STATUS.md` for the migration's history, what was fixed vs. reproduced,
and what remains open.

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
