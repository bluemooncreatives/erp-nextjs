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
  /**
   * `__('group.Phrase')` for the label. The keys in `lang/` are the English
   * source strings, so `label` doubles as the fallback when a locale has not
   * translated it.
   */
  labelKey?: string;
  /**
   * Icon name from `layout/nav-icons.tsx`. Only top-level leaves need one -
   * they sit in the same column as the groups' icons, and the collapsed rail
   * has nothing but the icon to go on. Leaves nested inside a group are drawn
   * as text under their parent, so they leave this unset.
   */
  icon?: string;
  /** Route name used both for the href and the permission check. */
  route: RouteName;
  /** Override when the link target differs from the permission being checked. */
  permission?: RouteName | string;
  /** Extra path prefixes that should also mark this item active. */
  activePaths?: string[];
  /**
   * Restrict the entry to these `roles.type` values. The Blade gated the
   * customer-portal items on `role_id == 4 or 5`, which are exactly the two
   * `normal_user` roles; naming the type rather than the ids survives an
   * install that numbers its roles differently.
   */
  roleTypes?: string[];
  /**
   * The Blade wrapped most items in `permissionCheck(...)`; a few it did not.
   * Those are visible to anyone the `roleTypes` gate lets through.
   */
  ungated?: boolean;
};

export type NavHeading = {
  kind: 'heading';
  label: string;
  labelKey?: string;
};

export type NavGroup = {
  kind: 'group';
  label: string;
  labelKey?: string;
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
    label: 'Dashboard', labelKey: 'common.Dashboard',
    icon: 'layout-dashboard',
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
    label: 'Sale', labelKey: 'sale.Sale',
    icon: 'store',
    permission: 'sale',
    match: ['/sale', '/conditional-sales'],
    children: [
      { kind: 'link', label: 'Sale', labelKey: 'sale.Sale', route: 'sale.index' },
      { kind: 'link', label: 'Sale Return', labelKey: 'sale.Sale Return', route: 'sale.return.index' },
      // `sale::conditional_menu` listed this beside the sale screens.
      { kind: 'link', label: 'Sale on Condition', labelKey: 'sale.Sale on Condition', route: 'conditional.sale.index' },
    ],
  },

  // ---------------------------------------------------------------- Contact
  {
    kind: 'group',
    label: 'Contacts', labelKey: 'common.Contacts',
    icon: 'users',
    permission: 'contact',
    match: ['/contact'],
    children: [
      {
        kind: 'link',
        label: 'Add Contacts', labelKey: 'common.Add Contacts',
        route: 'add_contact.index',
        permission: 'add_contact.store',
      },
      { kind: 'link', label: 'Supplier', labelKey: 'common.Supplier', route: 'supplier' },
      { kind: 'link', label: 'Customer', labelKey: 'common.Customer', route: 'customer' },
      { kind: 'link', label: 'Settings', labelKey: 'common.Settings', route: 'contact.settings' },
    ],
  },

  // ---------------------------------------------------------------- Product
  {
    kind: 'group',
    label: 'Products', labelKey: 'common.Products',
    icon: 'package',
    permission: 'product',
    match: ['/product'],
    children: [
      {
        kind: 'link',
        label: 'Product List', labelKey: 'common.Product List',
        route: 'add_product.create',
        permission: 'add_product.create',
      },
      {
        kind: 'link',
        label: 'Service', labelKey: 'product.Service',
        route: 'add_product.service',
        permission: 'add_product.create',
      },
      { kind: 'link', label: 'Add Product', labelKey: 'common.Add Product', route: 'add_product.index' },
      { kind: 'link', label: 'Category', labelKey: 'common.Category', route: 'category.index' },
      { kind: 'link', label: 'Brand', labelKey: 'common.Brand', route: 'brand.index' },
      { kind: 'link', label: 'Model', labelKey: 'common.Model', route: 'model.index' },
      { kind: 'link', label: 'Unit Type', labelKey: 'common.Unit Type', route: 'unit_type.index' },
      { kind: 'link', label: 'Variant', labelKey: 'common.Variant', route: 'variant.index' },
    ],
  },

  // -------------------------------------------------------------- Inventory
  {
    kind: 'group',
    label: 'Inventory', labelKey: 'inventory.Inventory',
    icon: 'boxes',
    permission: 'inventory',
    match: ['/inventory'],
    children: [
      { kind: 'link', label: 'Add Opening Stock', labelKey: 'common.Add Opening Stock', route: 'add_opening_stock_create' },
      { kind: 'link', label: 'Recieve Your Product', labelKey: 'purchase.Recieve Your Product', route: 'purchase_order.recieve.index' },
      { kind: 'link', label: 'Product Costing', labelKey: 'inventory.Product Costing', route: 'purchase_order.cost_of_goods.index' },
      { kind: 'heading', label: 'Sales' },
      { kind: 'link', label: 'Stock Transfer', labelKey: 'common.Stock Transfer', route: 'stock-transfer.index' },
      { kind: 'link', label: 'Stock List', labelKey: 'common.Stock List', route: 'stock.report' },
      { kind: 'link', label: 'Product Movement', labelKey: 'inventory.Product Movement', route: 'product_movement.index' },
      { kind: 'link', label: 'Stock Adjustment', labelKey: 'common.Stock Adjustment', route: 'stock_adjustment.index' },
      {
        kind: 'link',
        label: 'Product Info', labelKey: 'inventory.Product Info',
        route: 'stock.product.info',
        permission: 'stock_adjustment.index',
      },
    ],
  },

  // --------------------------------------------------------------- Purchase
  {
    kind: 'group',
    label: 'Purchase', labelKey: 'common.Purchase',
    icon: 'truck',
    permission: 'purchase',
    match: ['/purchase'],
    children: [
      { kind: 'link', label: 'Purchase Order', labelKey: 'purchase.Purchase Order', route: 'purchase_order.index' },
      { kind: 'link', label: 'Stock Alert List', labelKey: 'dashboard.Stock Alert List', route: 'purchase.suggest' },
      { kind: 'link', label: 'Purchase Return List', labelKey: 'purchase.Purchase Return List', route: 'purchase.return.index' },
      {
        kind: 'link',
        label: 'CNF', labelKey: 'purchase.CNF',
        route: 'cnf.index',
        permission: 'purchase.return.index',
      },
    ],
  },

  // -------------------------------------------------------------- Quotation
  {
    kind: 'group',
    label: 'Quotation', labelKey: 'quotation.Quotation',
    icon: 'file-text',
    permission: 'quotation',
    match: ['/quotation'],
    children: [{ kind: 'link', label: 'Quotation', labelKey: 'quotation.Quotation', route: 'quotation.index' }],
  },

  // ---------------------------------------------------------------- Account
  {
    kind: 'group',
    label: 'Accounts', labelKey: 'account.Accounts',
    icon: 'wallet',
    permission: 'accounts',
    match: ['/account'],
    children: [
      { kind: 'link', label: 'Add Expense', labelKey: 'inventory.Add Expense', route: 'expenses.create' },
      { kind: 'link', label: 'Expense Lists', labelKey: 'inventory.Expense Lists', route: 'expenses.index' },
      { kind: 'link', label: 'Add Income', labelKey: 'inventory.Add Income', route: 'income.create' },
      { kind: 'link', label: 'Income Lists', labelKey: 'account.Income Lists', route: 'income.index' },
      { kind: 'link', label: 'Bank Accounts', labelKey: 'account.Bank Accounts', route: 'bank_accounts.index' },
      { kind: 'link', label: 'Opening Balance', labelKey: 'common.Opening Balance', route: 'openning_balance.create' },
      { kind: 'link', label: 'Chart Of Accounts', labelKey: 'account.Chart Of Accounts', route: 'char_accounts.index' },

      { kind: 'heading', label: 'Report' },
      { kind: 'link', label: 'Transactions', labelKey: 'common.Transactions', route: 'transaction.index' },
      { kind: 'link', label: 'Statement', labelKey: 'account.Statement', route: 'statement.index' },
      { kind: 'link', label: 'Profit & Loss', labelKey: 'report.Profit & Loss', route: 'profit.index' },
      { kind: 'link', label: 'Account Balance', labelKey: 'account.Account Balance', route: 'account.balance.index' },
      { kind: 'link', label: 'Income By Customer', labelKey: 'account.Income By Customer', route: 'income_by_customer' },
      { kind: 'link', label: 'Expense By Supplier', labelKey: 'account.Expense By Supplier', route: 'expense_by_supplier' },
      { kind: 'link', label: 'Sales Tax', labelKey: 'account.Sales Tax', route: 'sale_tax' },

      { kind: 'heading', label: 'Transfer' },
      { kind: 'link', label: 'Make A Transfer', labelKey: 'account.Make A Transfer', route: 'transfer_showroom.create' },
      { kind: 'link', label: 'Transfered Lists', labelKey: 'account.Transfered Lists', route: 'transfer_showroom.index' },
    ],
  },

  // ----------------------------------------------------------------- Report
  {
    kind: 'group',
    label: 'Reports', labelKey: 'report.Reports',
    icon: 'bar-chart',
    permission: 'report',
    match: ['/report'],
    children: [
      { kind: 'heading', label: 'Sale' },
      { kind: 'link', label: 'Sale Reports', labelKey: 'report.Sale Reports', route: 'sales_report.index' },
      { kind: 'link', label: 'Product Wise Sale', labelKey: 'report.Product Wise Sale', route: 'product_sales_report.index' },
      { kind: 'link', label: 'Sales Return', labelKey: 'report.Sales Return', route: 'sales_return_report.index' },

      { kind: 'heading', label: 'Purchase' },
      { kind: 'link', label: 'Purchase Reports', labelKey: 'report.Purchase Reports', route: 'purchase_report.index' },
      { kind: 'link', label: 'Product wise Purchase', labelKey: 'report.Product wise Purchase', route: 'product_purchase_report.index' },
      {
        kind: 'link',
        label: 'Purchase History', labelKey: 'report.Purchase History',
        route: 'purchase.history',
        permission: 'sale.history',
      },

      { kind: 'heading', label: 'Customer' },
      { kind: 'link', label: 'Customer Reports', labelKey: 'report.Customer Reports', route: 'customer_report.index' },
      { kind: 'link', label: 'Customer Bill', labelKey: 'report.Customer Bill', route: 'customer.bill' },

      { kind: 'heading', label: 'Supplier' },
      { kind: 'link', label: 'Supplier Reports', labelKey: 'report.Supplier Reports', route: 'supplier_report.index' },
      { kind: 'link', label: 'Supplier Bill', labelKey: 'report.Supplier Bill', route: 'supplier.bill' },

      { kind: 'heading', label: 'Serial No Report' },
      {
        kind: 'link',
        label: 'Product Serial Report', labelKey: 'report.Product Serial Report',
        route: 'serial._product_report.index',
      },
    ],
  },

  // ------------------------------------------------------- Location + HR
  {
    kind: 'group',
    label: 'Location', labelKey: 'event.Location',
    icon: 'map-pin',
    permission: 'showroom.index',
    match: ['/setup/showroom', '/setup/warehouse'],
    children: [
      { kind: 'link', label: 'Branch', labelKey: 'inventory.Branch', route: 'showroom.index' },
      { kind: 'link', label: 'Warehouse', labelKey: 'inventory.Warehouse', route: 'warehouse.index' },
    ],
  },
  {
    kind: 'group',
    label: 'Human Resource', labelKey: 'common.Human Resource',
    icon: 'id-card',
    permission: 'human_resource',
    match: ['/hr', '/attendance', '/payroll', '/setup/apply-loan', '/permission'],
    children: [
      { kind: 'link', label: 'Staff', labelKey: 'common.Staff', route: 'staffs.index' },
      { kind: 'link', label: 'Role', labelKey: 'common.Role', route: 'permission.roles.index' },
      { kind: 'link', label: 'Department', labelKey: 'department.Department', route: 'departments.index' },
      { kind: 'link', label: 'Attendance', labelKey: 'common.Attendance', route: 'attendances.index' },
      { kind: 'link', label: 'Attendance Report', labelKey: 'attendance.Attendance Report', route: 'attendance_report.index' },
      { kind: 'link', label: 'Event', labelKey: 'event.Event', route: 'events.index' },
      { kind: 'link', label: 'Payroll', labelKey: 'payroll.Payroll', route: 'payroll.index' },
      { kind: 'link', label: 'Payroll Reports', labelKey: 'payroll.Payroll Reports', route: 'payroll_reports.index' },
      { kind: 'link', label: 'Loan Apply', labelKey: 'common.Loan Apply', route: 'apply_loans.index' },
      { kind: 'link', label: 'Loan History', labelKey: 'setup.Loan History', route: 'apply_loans.history' },
      { kind: 'link', label: 'Loan Approval', labelKey: 'common.Loan Approval', route: 'apply_loans.loan_approval_index' },
    ],
  },

  // ------------------------------------------------------------------ Leave
  {
    kind: 'group',
    label: 'Leave', labelKey: 'leave.Leave',
    icon: 'calendar',
    permission: 'leave',
    match: ['/leave'],
    children: [
      { kind: 'link', label: 'Leave Type', labelKey: 'leave.Leave Type', route: 'leave_types.index' },
      { kind: 'link', label: 'Leave Define', labelKey: 'leave.Leave Define', route: 'leave_define.index' },
      { kind: 'link', label: 'Apply Leave', labelKey: 'leave.Apply Leave', route: 'apply_leave.index' },
      { kind: 'link', label: 'Approve Leave Request', labelKey: 'leave.Approve Leave Request', route: 'approved_index' },
      { kind: 'link', label: 'Pending Leave', labelKey: 'leave.Pending Leave', route: 'pending_index' },
      // Both Attendance and Leave register a `holidays` resource, so
      // `holidays.index` is ambiguous in Laravel. The Blade's own active check
      // is `request()->is('leave/holidays')`, which settles it: this item is
      // the Leave module's Holiday Setup, not the Attendance list. It is also
      // the one entry the Blade left ungated.
      {
        kind: 'link',
        label: 'Holiday Setup', labelKey: 'holiday.Holiday Setup',
        route: 'year.data',
        permission: 'leave',
        activePaths: ['/leave/holidays'],
      },
      { kind: 'link', label: 'Carry Forward', labelKey: 'leave.Carry Forward', route: 'carry.forward' },
    ],
  },

  // --------------------------------------------------- Customer / supplier
  // `Modules/Contact/Resources/views/menu.blade.php` shows these four as
  // top-level items, ungated by permission, to `role_id == 4 or 5`. Without
  // them a signed-in contact gets a sidebar with nothing in it.
  {
    kind: 'link',
    label: 'My Details', labelKey: 'common.My Details',
    icon: 'id-card',
    route: 'contact.my_details',
    ungated: true,
    roleTypes: ['normal_user'],
  },
  {
    kind: 'link',
    label: 'Invoice', labelKey: 'common.Invoice',
    icon: 'file-text',
    route: 'contact.invoice',
    ungated: true,
    roleTypes: ['normal_user'],
  },
  {
    kind: 'link',
    label: 'Return', labelKey: 'common.Return',
    icon: 'truck',
    route: 'contact.return',
    ungated: true,
    roleTypes: ['normal_user'],
  },
  {
    kind: 'link',
    label: 'Transaction', labelKey: 'common.Transaction',
    icon: 'wallet',
    route: 'contact.transaction',
    ungated: true,
    roleTypes: ['normal_user'],
  },

  // ---------------------------------------------------------------- Setting
  {
    kind: 'group',
    label: 'System Settings', labelKey: 'setting.System Settings',
    icon: 'settings',
    permission: 'setting.index',
    match: ['/setting', '/localization', '/setup'],
    children: [
      // The PHP menu exposed a single Settings page with tabbed sections; the
      // `general_settings.index` / `invoice_settings.index` / `email_template.index`
      // / `sms_template.index` permission rows have no matching routes in this
      // build, so they stay tabs on `setting.index` rather than menu entries.
      { kind: 'link', label: 'Settings', labelKey: 'common.Settings', route: 'setting.index' },
      { kind: 'link', label: 'Payment Method Setting', labelKey: 'setting.Payment Method Setting', route: 'payment-method-settings' },
      { kind: 'link', label: 'Update', labelKey: 'common.Update', route: 'setting.updatesystem' },

      { kind: 'heading', label: 'Setup' },
      { kind: 'link', label: 'Tax', labelKey: 'common.Tax', route: 'tax.index' },
      { kind: 'link', label: 'Intro Prefix', labelKey: 'common.Intro Prefix', route: 'introPrefix.index' },
      { kind: 'link', label: 'Currencies', route: 'currencies.index' },
      { kind: 'link', label: 'Language', labelKey: 'common.Language', route: 'languages.index' },
      { kind: 'link', label: 'Country', labelKey: 'contact.Country', route: 'country.index' },
      { kind: 'link', label: 'Printer', labelKey: 'common.Printer', route: 'printer.index', permission: 'printer.create' },

      { kind: 'heading', label: 'Styles' },
      { kind: 'link', label: 'Theme Customization', labelKey: 'setting.Theme Customization', route: 'themes.index' },
      { kind: 'link', label: 'Change View', labelKey: 'common.Change View', route: 'themes.change_view' },
      { kind: 'link', label: 'Background', labelKey: 'setting.Background', route: 'guest-background' },
    ],
  },

  // ----------------------------------------------------------------- Backup
  {
    kind: 'link',
    label: 'Backup', labelKey: 'common.Backup',
    icon: 'database-backup',
    route: 'backup.index',
  },

  // ----------------------------------------------------------- Activity Log
  {
    kind: 'group',
    label: 'All Activity Logs', labelKey: 'common.All Activity Logs',
    icon: 'history',
    permission: 'activity_log',
    match: ['/useractivitylog'],
    children: [
      { kind: 'link', label: 'Activity Logs', labelKey: 'common.Activity Logs', route: 'activity_log' },
      { kind: 'link', label: 'Login Activity', labelKey: 'common.Login Activity', route: 'activity_log.login' },
    ],
  },
];

/** The permission a nav entry is guarded by. */
export function navPermission(item: NavLeaf): string {
  return item.permission ?? item.route;
}

/**
 * The header's "+" dropdown - `resources/views/backEnd/partials/menu.blade.php`.
 *
 * Each entry is one create action under a heading, gated by the permission the
 * Blade checked. Three of them check a `.create` permission but link to the
 * index, because those screens are inline forms rather than separate pages;
 * that is the Blade's own pairing, kept.
 */
export type QuickAddItem = {
  heading: string;
  headingKey?: string;
  label: string;
  labelKey?: string;
  route: RouteName;
  permission: RouteName | string;
};

export const QUICK_ADD: QuickAddItem[] = [
  { heading: 'Sales', headingKey: 'inventory.Sales', label: 'Add Sale', labelKey: 'sale.Add Sale', route: 'sale.create', permission: 'sale.create' },
  {
    heading: 'Contact', headingKey: 'contact.Contact',
    label: 'Add Contact', labelKey: 'common.Add Contact',
    // The Blade linked `route('add_contact.store')`, which is the POST target -
    // following it in Laravel is a 405. The create screen is what it meant.
    route: 'add_contact.create',
    permission: 'add_contact.store',
  },
  {
    heading: 'Products', headingKey: 'common.Products',
    label: 'Recieve Product', labelKey: 'common.Recieve Product',
    route: 'purchase_order.recieve.index',
    permission: 'purchase_order.recieve.index',
  },
  {
    heading: 'Purchase', headingKey: 'common.Purchase',
    label: 'Add Purchase', labelKey: 'purchase.Add Purchase',
    route: 'purchase_order.create',
    permission: 'purchase_order.create',
  },
  {
    heading: 'Money Transfer', headingKey: 'account.Money Transfer',
    label: 'Add Money Transfer', labelKey: 'account.Add Money Transfer',
    route: 'transfer_showroom.create',
    permission: 'transfer_showroom.create',
  },
  { heading: 'Staff', headingKey: 'common.Staff', label: 'Add Staff', labelKey: 'common.Add Staff', route: 'staffs.create', permission: 'staffs.create' },
  {
    heading: 'Intro Prefix', headingKey: 'common.Intro Prefix',
    label: 'Add Intro Prefix', labelKey: 'common.Add Intro Prefix',
    route: 'introPrefix.index',
    permission: 'introPrefix.create',
  },
  { heading: 'Tax', headingKey: 'common.Tax', label: 'Add Tax', labelKey: 'account.Add Tax', route: 'tax.index', permission: 'tax.create' },
  {
    heading: 'Printer', headingKey: 'common.Printer',
    label: 'Add Printer', labelKey: 'common.Add Printer',
    route: 'printer.index',
    permission: 'printer.create',
  },
  {
    heading: 'Payments', headingKey: 'common.Payments',
    label: 'Add Payments', labelKey: 'account.Add Payments',
    route: 'vouchers.create',
    permission: 'vouchers.create',
  },
  {
    heading: 'Recieve', headingKey: 'common.Recieve',
    label: 'Add Recieve', labelKey: 'common.Add Recieve',
    route: 'voucher_recieve.create',
    permission: 'voucher_recieve.create',
  },
];

/**
 * Whether a leaf is offered to this kind of user at all.
 *
 * Unset `roleTypes` means every role, which is what the Blade's unwrapped
 * items did; a set one is the `role_id == 4 or 5` gate the customer-portal
 * entries carried, named by `roles.type` instead of by id.
 */
export function navVisible(item: NavLeaf, roleType: string): boolean {
  return !item.roleTypes || item.roleTypes.includes(roleType);
}

/** Resolve a leaf's href. */
export function navHref(item: NavLeaf): string {
  return ROUTES[item.route];
}
