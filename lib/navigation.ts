// ---------------------------------------------------------------------------
// Sidebar navigation.
//
// A direct port of the Blade menu partials, in the same order the PHP sidebar
// rendered them (resources/views/backEnd/partials/sidebar.blade.php):
//
//   Dashboard, Project, Sale, Contact, Product, Inventory, Purchase,
//   Quotation, Account, HR/Location, Leave, Setting, Backup, Activity Log
//
// Each entry keeps the `permissionCheck(...)` route name the Blade template
// guarded it with, so visibility is decided by the same rows in the
// `permissions` / `role_permission` tables.
// ---------------------------------------------------------------------------

import { ROUTES, type RouteName } from './routes';

export type NavLeaf = {
  kind: 'link';
  label: string;
  /** Route name used both for the href and the permission check. */
  route: RouteName;
  /** Override when the link target differs from the permission being checked. */
  permission?: RouteName | string;
  /** Extra path prefixes that should also mark this item active. */
  activePaths?: string[];
};

export type NavHeading = {
  kind: 'heading';
  label: string;
};

export type NavGroup = {
  kind: 'group';
  label: string;
  icon: string;
  /** Permission guarding the whole group - the type-1 "main menu" permission. */
  permission: string;
  /** URL prefix that marks the group expanded. */
  match: string[];
  children: Array<NavLeaf | NavHeading>;
};

export type NavItem = NavGroup | NavLeaf;

export const NAVIGATION: NavItem[] = [
  {
    kind: 'link',
    label: 'Dashboard',
    route: 'home',
    permission: 'dashboard',
  },

  // ---------------------------------------------------------------- Project
  {
    kind: 'group',
    label: 'Project Management',
    icon: 'briefcase',
    permission: 'project',
    match: ['/project', '/projects', '/tasks', '/teams'],
    children: [
      { kind: 'link', label: 'Projects', route: 'project.index' },
      { kind: 'link', label: 'Teams', route: 'team.index' },
    ],
  },

  // ------------------------------------------------------------------- Sale
  {
    kind: 'group',
    label: 'Sale',
    icon: 'store',
    permission: 'sale',
    match: ['/sale', '/conditional-sales'],
    children: [
      { kind: 'link', label: 'Sale', route: 'sale.index' },
      { kind: 'link', label: 'Sale Return', route: 'sale.return.index' },
      // `sale::conditional_menu` listed this beside the sale screens.
      { kind: 'link', label: 'Sale on Condition', route: 'conditional.sale.index' },
    ],
  },

  // ---------------------------------------------------------------- Contact
  {
    kind: 'group',
    label: 'Contacts',
    icon: 'users',
    permission: 'contact',
    match: ['/contact'],
    children: [
      {
        kind: 'link',
        label: 'Add Contacts',
        route: 'add_contact.index',
        permission: 'add_contact.store',
      },
      { kind: 'link', label: 'Supplier', route: 'supplier' },
      { kind: 'link', label: 'Customer', route: 'customer' },
      { kind: 'link', label: 'Settings', route: 'contact.settings' },
    ],
  },

  // ---------------------------------------------------------------- Product
  {
    kind: 'group',
    label: 'Products',
    icon: 'package',
    permission: 'product',
    match: ['/product'],
    children: [
      {
        kind: 'link',
        label: 'Product List',
        route: 'add_product.create',
        permission: 'add_product.create',
      },
      {
        kind: 'link',
        label: 'Service',
        route: 'add_product.service',
        permission: 'add_product.create',
      },
      { kind: 'link', label: 'Add Product', route: 'add_product.index' },
      { kind: 'link', label: 'Category', route: 'category.index' },
      { kind: 'link', label: 'Brand', route: 'brand.index' },
      { kind: 'link', label: 'Model', route: 'model.index' },
      { kind: 'link', label: 'Unit Type', route: 'unit_type.index' },
      { kind: 'link', label: 'Variant', route: 'variant.index' },
    ],
  },

  // -------------------------------------------------------------- Inventory
  {
    kind: 'group',
    label: 'Inventory',
    icon: 'boxes',
    permission: 'inventory',
    match: ['/inventory'],
    children: [
      { kind: 'link', label: 'Add Opening Stock', route: 'add_opening_stock_create' },
      { kind: 'link', label: 'Recieve Your Product', route: 'purchase_order.recieve.index' },
      { kind: 'link', label: 'Product Costing', route: 'purchase_order.cost_of_goods.index' },
      { kind: 'heading', label: 'Sales' },
      { kind: 'link', label: 'Stock Transfer', route: 'stock-transfer.index' },
      { kind: 'link', label: 'Stock List', route: 'stock.report' },
      { kind: 'link', label: 'Product Movement', route: 'product_movement.index' },
      { kind: 'link', label: 'Stock Adjustment', route: 'stock_adjustment.index' },
      {
        kind: 'link',
        label: 'Product Info',
        route: 'stock.product.info',
        permission: 'stock_adjustment.index',
      },
    ],
  },

  // --------------------------------------------------------------- Purchase
  {
    kind: 'group',
    label: 'Purchase',
    icon: 'truck',
    permission: 'purchase',
    match: ['/purchase'],
    children: [
      { kind: 'link', label: 'Purchase Order', route: 'purchase_order.index' },
      { kind: 'link', label: 'Stock Alert List', route: 'purchase.suggest' },
      { kind: 'link', label: 'Purchase Return List', route: 'purchase.return.index' },
      {
        kind: 'link',
        label: 'CNF',
        route: 'cnf.index',
        permission: 'purchase.return.index',
      },
    ],
  },

  // -------------------------------------------------------------- Quotation
  {
    kind: 'group',
    label: 'Quotation',
    icon: 'file-text',
    permission: 'quotation',
    match: ['/quotation'],
    children: [{ kind: 'link', label: 'Quotation', route: 'quotation.index' }],
  },

  // ---------------------------------------------------------------- Account
  {
    kind: 'group',
    label: 'Accounts',
    icon: 'wallet',
    permission: 'accounts',
    match: ['/account'],
    children: [
      { kind: 'link', label: 'Add Expense', route: 'expenses.create' },
      { kind: 'link', label: 'Expense Lists', route: 'expenses.index' },
      { kind: 'link', label: 'Add Income', route: 'income.create' },
      { kind: 'link', label: 'Income Lists', route: 'income.index' },
      { kind: 'link', label: 'Bank Accounts', route: 'bank_accounts.index' },
      { kind: 'link', label: 'Opening Balance', route: 'openning_balance.create' },
      { kind: 'link', label: 'Chart Of Accounts', route: 'char_accounts.index' },

      { kind: 'heading', label: 'Report' },
      { kind: 'link', label: 'Transactions', route: 'transaction.index' },
      { kind: 'link', label: 'Statement', route: 'statement.index' },
      { kind: 'link', label: 'Profit & Loss', route: 'profit.index' },
      { kind: 'link', label: 'Account Balance', route: 'account.balance.index' },
      { kind: 'link', label: 'Income By Customer', route: 'income_by_customer' },
      { kind: 'link', label: 'Expense By Supplier', route: 'expense_by_supplier' },
      { kind: 'link', label: 'Sales Tax', route: 'sale_tax' },

      { kind: 'heading', label: 'Transfer' },
      { kind: 'link', label: 'Make A Transfer', route: 'transfer_showroom.create' },
      { kind: 'link', label: 'Transfered Lists', route: 'transfer_showroom.index' },
    ],
  },

  // ----------------------------------------------------------------- Report
  {
    kind: 'group',
    label: 'Reports',
    icon: 'bar-chart',
    permission: 'report',
    match: ['/report'],
    children: [
      { kind: 'heading', label: 'Sale' },
      { kind: 'link', label: 'Sale Reports', route: 'sales_report.index' },
      { kind: 'link', label: 'Product Wise Sale', route: 'product_sales_report.index' },
      { kind: 'link', label: 'Sales Return', route: 'sales_return_report.index' },

      { kind: 'heading', label: 'Purchase' },
      { kind: 'link', label: 'Purchase Reports', route: 'purchase_report.index' },
      { kind: 'link', label: 'Product wise Purchase', route: 'product_purchase_report.index' },
      {
        kind: 'link',
        label: 'Purchase History',
        route: 'purchase.history',
        permission: 'sale.history',
      },

      { kind: 'heading', label: 'Customer' },
      { kind: 'link', label: 'Customer Reports', route: 'customer_report.index' },
      { kind: 'link', label: 'Customer Bill', route: 'customer.bill' },

      { kind: 'heading', label: 'Supplier' },
      { kind: 'link', label: 'Supplier Reports', route: 'supplier_report.index' },
      { kind: 'link', label: 'Supplier Bill', route: 'supplier.bill' },

      { kind: 'heading', label: 'Serial No Report' },
      {
        kind: 'link',
        label: 'Product Serial Report',
        route: 'serial._product_report.index',
      },
    ],
  },

  // ------------------------------------------------------- Location + HR
  {
    kind: 'group',
    label: 'Location',
    icon: 'map-pin',
    permission: 'showroom.index',
    match: ['/setup/showroom', '/setup/warehouse'],
    children: [
      { kind: 'link', label: 'Branch', route: 'showroom.index' },
      { kind: 'link', label: 'Warehouse', route: 'warehouse.index' },
    ],
  },
  {
    kind: 'group',
    label: 'Human Resource',
    icon: 'id-card',
    permission: 'human_resource',
    match: ['/hr', '/attendance', '/payroll', '/setup/apply-loan', '/permission'],
    children: [
      { kind: 'link', label: 'Staff', route: 'staffs.index' },
      { kind: 'link', label: 'Role', route: 'permission.roles.index' },
      { kind: 'link', label: 'Department', route: 'departments.index' },
      { kind: 'link', label: 'Attendance', route: 'attendances.index' },
      { kind: 'link', label: 'Attendance Report', route: 'attendance_report.index' },
      { kind: 'link', label: 'Event', route: 'events.index' },
      { kind: 'link', label: 'Payroll', route: 'payroll.index' },
      { kind: 'link', label: 'Payroll Reports', route: 'payroll_reports.index' },
      { kind: 'link', label: 'Loan Apply', route: 'apply_loans.index' },
      { kind: 'link', label: 'Loan History', route: 'apply_loans.history' },
      { kind: 'link', label: 'Loan Approval', route: 'apply_loans.loan_approval_index' },
    ],
  },

  // ------------------------------------------------------------------ Leave
  {
    kind: 'group',
    label: 'Leave',
    icon: 'calendar',
    permission: 'leave',
    match: ['/leave'],
    children: [
      { kind: 'link', label: 'Leave Type', route: 'leave_types.index' },
      { kind: 'link', label: 'Leave Define', route: 'leave_define.index' },
      { kind: 'link', label: 'Apply Leave', route: 'apply_leave.index' },
      { kind: 'link', label: 'Approve Leave Request', route: 'approved_index' },
      { kind: 'link', label: 'Pending Leave', route: 'pending_index' },
      { kind: 'link', label: 'Holiday Setup', route: 'holidays.index' },
      { kind: 'link', label: 'Carry Forward', route: 'carry.forward' },
    ],
  },

  // ---------------------------------------------------------------- Setting
  {
    kind: 'group',
    label: 'System Settings',
    icon: 'settings',
    permission: 'setting.index',
    match: ['/setting', '/localization', '/setup'],
    children: [
      // The PHP menu exposed a single Settings page with tabbed sections; the
      // `general_settings.index` / `invoice_settings.index` / `email_template.index`
      // / `sms_template.index` permission rows have no matching routes in this
      // build, so they stay tabs on `setting.index` rather than menu entries.
      { kind: 'link', label: 'Settings', route: 'setting.index' },
      { kind: 'link', label: 'Payment Method Setting', route: 'payment-method-settings' },
      { kind: 'link', label: 'Update', route: 'setting.updatesystem' },

      { kind: 'heading', label: 'Setup' },
      { kind: 'link', label: 'Tax', route: 'tax.index' },
      { kind: 'link', label: 'Intro Prefix', route: 'introPrefix.index' },
      { kind: 'link', label: 'Currencies', route: 'currencies.index' },
      { kind: 'link', label: 'Language', route: 'languages.index' },
      { kind: 'link', label: 'Country', route: 'country.index' },
      { kind: 'link', label: 'Printer', route: 'printer.index', permission: 'printer.create' },

      { kind: 'heading', label: 'Styles' },
      { kind: 'link', label: 'Theme Customization', route: 'themes.index' },
      { kind: 'link', label: 'Background', route: 'guest-background' },
    ],
  },

  // ----------------------------------------------------------------- Backup
  {
    kind: 'link',
    label: 'Backup',
    route: 'backup.index',
  },

  // ----------------------------------------------------------- Activity Log
  {
    kind: 'group',
    label: 'All Activity Logs',
    icon: 'history',
    permission: 'activity_log',
    match: ['/useractivitylog'],
    children: [
      { kind: 'link', label: 'Activity Logs', route: 'activity_log' },
      { kind: 'link', label: 'Login Activity', route: 'activity_log.login' },
    ],
  },
];

/** The permission a nav entry is guarded by. */
export function navPermission(item: NavLeaf): string {
  return item.permission ?? item.route;
}

/** Resolve a leaf's href. */
export function navHref(item: NavLeaf): string {
  return ROUTES[item.route];
}
