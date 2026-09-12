// ---------------------------------------------------------------------------
// Database schema - generated from the PHP stack's MySQL dump (software_erp.sql)
// and kept at 1:1 column parity with the Laravel migrations.
//
// Table and column names are the ORIGINAL snake_case names so this app reads and
// writes the exact same database the PHP application used. Only the TypeScript
// property names are camelCased.
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  date,
  datetime,
  double,
  int,
  json,
  longtext,
  mysqlTable,
  smallint,
  text,
  timestamp,
  tinyint,
  varchar,
  year,
} from 'drizzle-orm/mysql-core';

export const accountCategories = mysqlTable('account_categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type AccountCategoriesRow = typeof accountCategories.$inferSelect;
export type NewAccountCategories = typeof accountCategories.$inferInsert;

export const accountConfigurationCategory = mysqlTable('account_configuration_category', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  accountCategoryId: int('account_category_id', { unsigned: true }).notNull(),
  chartAccountId: int('chart_account_id', { unsigned: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type AccountConfigurationCategoryRow = typeof accountConfigurationCategory.$inferSelect;
export type NewAccountConfigurationCategory = typeof accountConfigurationCategory.$inferInsert;

export const activityLog = mysqlTable('activity_log', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  logName: varchar('log_name', { length: 191 }),
  description: text('description').notNull(),
  subjectId: bigint('subject_id', { mode: 'number', unsigned: true }),
  subjectType: varchar('subject_type', { length: 191 }),
  causerId: bigint('causer_id', { mode: 'number', unsigned: true }),
  causerType: varchar('causer_type', { length: 191 }),
  properties: json('properties'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;

export const applyLeaves = mysqlTable('apply_leaves', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  leaveTypeId: bigint('leave_type_id', { mode: 'number', unsigned: true }).notNull(),
  reason: text('reason').notNull(),
  attachment: varchar('attachment', { length: 255 }),
  applyDate: date('apply_date', { mode: 'string' }).notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  day: tinyint('day').notNull(),
  makeupLeave: tinyint('makeup_leave').notNull().default(0),
  makeupDate: date('makeup_date', { mode: 'string' }),
  makeupHalf: tinyint('makeup_half').notNull().default(0),
  leaveFrom: tinyint('leave_from').notNull().default(0),
  leaveTo: tinyint('leave_to').notNull().default(0),
  totalDays: double('total_days').notNull().default(0),
  status: tinyint('status').notNull().default(0),
  approvedBy: bigint('approved_by', { mode: 'number', unsigned: true }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ApplyLeavesRow = typeof applyLeaves.$inferSelect;
export type NewApplyLeaves = typeof applyLeaves.$inferInsert;

export const applyLoans = mysqlTable('apply_loans', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  departmentId: bigint('department_id', { mode: 'number', unsigned: true }).notNull().default(1),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull().default(1),
  title: varchar('title', { length: 255 }),
  loanType: varchar('loan_type', { length: 255 }),
  applyDate: date('apply_date', { mode: 'string' }),
  loanDate: date('loan_date', { mode: 'string' }),
  amount: double('amount', { precision: 12, scale: 2 }).notNull().default(0.00),
  paidLoanAmount: double('paid_loan_amount', { precision: 12, scale: 2 }).notNull().default(0.00),
  totalMonth: int('total_month'),
  monthlyInstallment: double('monthly_installment', { precision: 12, scale: 2 }).notNull().default(0.00),
  note: text('note'),
  approval: tinyint('approval').notNull().default(0),
  paid: tinyint('paid').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ApplyLoansRow = typeof applyLoans.$inferSelect;
export type NewApplyLoans = typeof applyLoans.$inferInsert;

export const attendances = mysqlTable('attendances', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  attendance: varchar('attendance', { length: 50 }).notNull().default("P"),
  date: date('date', { mode: 'string' }),
  day: varchar('day', { length: 30 }),
  month: varchar('month', { length: 30 }),
  year: int('year'),
  note: varchar('note', { length: 255 }),
  userId: int('user_id', { unsigned: true }).notNull().default(1),
  roleId: int('role_id', { unsigned: true }).notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type AttendancesRow = typeof attendances.$inferSelect;
export type NewAttendances = typeof attendances.$inferInsert;

export const bankAccounts = mysqlTable('bank_accounts', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  bankName: varchar('bank_name', { length: 191 }),
  chartAccountId: bigint('chart_account_id', { mode: 'number', unsigned: true }).notNull(),
  branchName: varchar('branch_name', { length: 191 }),
  accountName: varchar('account_name', { length: 191 }),
  accountNo: varchar('account_no', { length: 191 }),
  description: text('description'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type BankAccountsRow = typeof bankAccounts.$inferSelect;
export type NewBankAccounts = typeof bankAccounts.$inferInsert;

export const brands = mysqlTable('brands', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type BrandsRow = typeof brands.$inferSelect;
export type NewBrands = typeof brands.$inferInsert;

export const businessSettings = mysqlTable('business_settings', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  categoryType: varchar('category_type', { length: 200 }),
  type: varchar('type', { length: 200 }),
  status: tinyint('status').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type BusinessSettingsRow = typeof businessSettings.$inferSelect;
export type NewBusinessSettings = typeof businessSettings.$inferInsert;

export const cNFs = mysqlTable('c_n_fs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  address: varchar('address', { length: 255 }),
  phone: varchar('phone', { length: 255 }),
  status: tinyint('status').notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type CNFsRow = typeof cNFs.$inferSelect;
export type NewCNFs = typeof cNFs.$inferInsert;

export const categories = mysqlTable('categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: text('description'),
  status: tinyint('status').notNull().default(0),
  level: bigint('level', { mode: 'number', unsigned: true }).notNull().default(0),
  parentId: bigint('parent_id', { mode: 'number', unsigned: true }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type CategoriesRow = typeof categories.$inferSelect;
export type NewCategories = typeof categories.$inferInsert;

export const chartAccounts = mysqlTable('chart_accounts', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 191 }),
  level: tinyint('level'),
  isGroup: tinyint('is_group').notNull().default(0),
  name: varchar('name', { length: 150 }).notNull(),
  type: varchar('type', { length: 150 }).notNull(),
  configurationGroupId: tinyint('configuration_group_id'),
  description: text('description'),
  parentId: bigint('parent_id', { mode: 'number', unsigned: true }),
  status: tinyint('status').notNull().default(0),
  contactableType: varchar('contactable_type', { length: 255 }),
  contactableId: bigint('contactable_id', { mode: 'number', unsigned: true }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ChartAccountsRow = typeof chartAccounts.$inferSelect;
export type NewChartAccounts = typeof chartAccounts.$inferInsert;

export const colorTheme = mysqlTable('color_theme', {
  colorId: bigint('color_id', { mode: 'number', unsigned: true }),
  themeId: bigint('theme_id', { mode: 'number', unsigned: true }),
  value: varchar('value', { length: 191 }),
});
export type ColorThemeRow = typeof colorTheme.$inferSelect;
export type NewColorTheme = typeof colorTheme.$inferInsert;

export const colors = mysqlTable('colors', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }),
  defaultValue: varchar('default_value', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ColorsRow = typeof colors.$inferSelect;
export type NewColors = typeof colors.$inferInsert;

export const comboProductDetails = mysqlTable('combo_product_details', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  comboProductId: bigint('combo_product_id', { mode: 'number', unsigned: true }),
  productQty: bigint('product_qty', { mode: 'number', unsigned: true }),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ComboProductDetailsRow = typeof comboProductDetails.$inferSelect;
export type NewComboProductDetails = typeof comboProductDetails.$inferInsert;

export const comboProducts = mysqlTable('combo_products', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  showroomId: bigint('showroom_id', { mode: 'number', unsigned: true }).notNull(),
  name: varchar('name', { length: 255 }),
  price: double('price', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalPurchasePrice: double('total_purchase_price', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalRegularPrice: double('total_regular_price', { precision: 16, scale: 2 }).notNull().default(0.00),
  minSellingPrice: int('min_selling_price').notNull().default(0),
  imageSource: varchar('image_source', { length: 191 }),
  description: text('description'),
  status: tinyint('status').notNull().default(1),
  barcodeId: varchar('barcode_id', { length: 255 }),
  barcodeType: varchar('barcode_type', { length: 255 }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ComboProductsRow = typeof comboProducts.$inferSelect;
export type NewComboProducts = typeof comboProducts.$inferInsert;

export const contacts = mysqlTable('contacts', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: varchar('user_id', { length: 191 }),
  contactType: varchar('contact_type', { length: 191 }).notNull(),
  name: varchar('name', { length: 191 }).notNull(),
  businessName: varchar('business_name', { length: 191 }),
  contactId: varchar('contact_id', { length: 191 }),
  taxNumber: varchar('tax_number', { length: 191 }),
  openingBalance: varchar('opening_balance', { length: 191 }).notNull().default("0"),
  payTerm: varchar('pay_term', { length: 191 }),
  payTermCondition: varchar('pay_term_condition', { length: 191 }).notNull(),
  customerGroup: varchar('customer_group', { length: 191 }),
  creditLimit: varchar('credit_limit', { length: 191 }),
  email: varchar('email', { length: 191 }),
  username: varchar('username', { length: 191 }),
  mobile: varchar('mobile', { length: 191 }),
  avatar: varchar('avatar', { length: 200 }),
  address: varchar('address', { length: 255 }),
  isActive: tinyint('is_active').notNull().default(1),
  alternateContactNo: varchar('alternate_contact_no', { length: 191 }),
  countryId: bigint('country_id', { mode: 'number', unsigned: true }),
  state: varchar('state', { length: 191 }),
  city: varchar('city', { length: 191 }),
  note: text('note'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ContactsRow = typeof contacts.$inferSelect;
export type NewContacts = typeof contacts.$inferInsert;

export const costOfGoodsHistories = mysqlTable('cost_of_goods_histories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  costableType: varchar('costable_type', { length: 191 }),
  costableId: bigint('costable_id', { mode: 'number', unsigned: true }),
  storeableType: varchar('storeable_type', { length: 191 }),
  storeableId: bigint('storeable_id', { mode: 'number', unsigned: true }),
  date: date('date', { mode: 'string' }),
  productSkuId: int('product_sku_id', { unsigned: true }),
  previousRemainingStock: int('previous_remaining_stock'),
  newlyStock: int('newly_stock'),
  previousCostOfGoodsSold: double('previous_cost_of_goods_sold', { precision: 16, scale: 2 }).notNull().default(0.00),
  newCostOfGoodsSold: double('new_cost_of_goods_sold', { precision: 16, scale: 2 }).notNull().default(0.00),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type CostOfGoodsHistoriesRow = typeof costOfGoodsHistories.$inferSelect;
export type NewCostOfGoodsHistories = typeof costOfGoodsHistories.$inferInsert;

export const countries = mysqlTable('countries', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }),
  iso3: varchar('iso3', { length: 10 }),
  iso2: varchar('iso2', { length: 10 }),
  phonecode: varchar('phonecode', { length: 30 }),
  currency: varchar('currency', { length: 30 }),
  capital: varchar('capital', { length: 50 }),
  activeStatus: tinyint('active_status'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type CountriesRow = typeof countries.$inferSelect;
export type NewCountries = typeof countries.$inferInsert;

export const coupons = mysqlTable('coupons', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull(),
  discountType: varchar('discount_type', { length: 191 }),
  cause: text('cause'),
  status: tinyint('status').notNull().default(1),
  startDate: date('start_date', { mode: 'string' }),
  endDate: date('end_date', { mode: 'string' }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type CouponsRow = typeof coupons.$inferSelect;
export type NewCoupons = typeof coupons.$inferInsert;

export const currencies = mysqlTable('currencies', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }),
  code: varchar('code', { length: 191 }),
  symbol: varchar('symbol', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type CurrenciesRow = typeof currencies.$inferSelect;
export type NewCurrencies = typeof currencies.$inferInsert;

export const dateFormats = mysqlTable('date_formats', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  format: varchar('format', { length: 191 }),
  normalView: varchar('normal_view', { length: 191 }),
  status: tinyint('status').notNull().default(1),
  createdBy: int('created_by', { unsigned: true }).default(1),
  updatedBy: int('updated_by', { unsigned: true }).default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type DateFormatsRow = typeof dateFormats.$inferSelect;
export type NewDateFormats = typeof dateFormats.$inferInsert;

export const departments = mysqlTable('departments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  details: varchar('details', { length: 191 }),
  status: tinyint('status').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type DepartmentsRow = typeof departments.$inferSelect;
export type NewDepartments = typeof departments.$inferInsert;

export const documents = mysqlTable('documents', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  voucherId: bigint('voucher_id', { mode: 'number', unsigned: true }).notNull(),
  bankName: varchar('bank_name', { length: 191 }),
  bankBranch: varchar('bank_branch', { length: 120 }),
  chequeNo: varchar('cheque_no', { length: 120 }),
  chequeDate: date('cheque_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type DocumentsRow = typeof documents.$inferSelect;
export type NewDocuments = typeof documents.$inferInsert;

export const emailTemplates = mysqlTable('email_templates', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  type: varchar('type', { length: 191 }),
  subject: varchar('subject', { length: 191 }),
  value: text('value'),
  availableVariable: text('available_variable'),
  status: tinyint('status').default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  for: varchar('for', { length: 191 }).notNull().default("email"),
});
export type EmailTemplatesRow = typeof emailTemplates.$inferSelect;
export type NewEmailTemplates = typeof emailTemplates.$inferInsert;

export const events = mysqlTable('events', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  title: varchar('title', { length: 191 }).notNull(),
  forWhom: varchar('for_whom', { length: 191 }).notNull(),
  location: varchar('location', { length: 191 }).notNull(),
  description: varchar('description', { length: 191 }),
  fromDate: date('from_date', { mode: 'string' }),
  toDate: date('to_date', { mode: 'string' }),
  image: varchar('image', { length: 191 }),
  status: tinyint('status').notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type EventsRow = typeof events.$inferSelect;
export type NewEvents = typeof events.$inferInsert;

export const expenses = mysqlTable('expenses', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  voucherId: bigint('voucher_id', { mode: 'number', unsigned: true }),
  showroomId: bigint('showroom_id', { mode: 'number', unsigned: true }),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ExpensesRow = typeof expenses.$inferSelect;
export type NewExpenses = typeof expenses.$inferInsert;

export const failedJobs = mysqlTable('failed_jobs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  connection: text('connection').notNull(),
  queue: text('queue').notNull(),
  payload: longtext('payload').notNull(),
  exception: longtext('exception').notNull(),
  failedAt: timestamp('failed_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type FailedJobsRow = typeof failedJobs.$inferSelect;
export type NewFailedJobs = typeof failedJobs.$inferInsert;

export const fieldOptions = mysqlTable('field_options', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  fieldId: bigint('field_id', { mode: 'number', unsigned: true }),
  color: varchar('color', { length: 50 }),
  option: varchar('option', { length: 191 }),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type FieldOptionsRow = typeof fieldOptions.$inferSelect;
export type NewFieldOptions = typeof fieldOptions.$inferInsert;

export const fieldProject = mysqlTable('field_project', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  fieldId: bigint('field_id', { mode: 'number', unsigned: true }),
  projectId: bigint('project_id', { mode: 'number', unsigned: true }),
  order: smallint('order', { unsigned: true }).notNull().default(0),
  visibility: tinyint('visibility').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type FieldProjectRow = typeof fieldProject.$inferSelect;
export type NewFieldProject = typeof fieldProject.$inferInsert;

export const fieldTask = mysqlTable('field_task', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true }),
  fieldId: bigint('field_id', { mode: 'number', unsigned: true }),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  optionId: bigint('option_id', { mode: 'number', unsigned: true }),
  date: timestamp('date', { mode: 'date' }),
  number: double('number', { precision: 20, scale: 6 }),
  text: longtext('text'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type FieldTaskRow = typeof fieldTask.$inferSelect;
export type NewFieldTask = typeof fieldTask.$inferInsert;

export const fields = mysqlTable('fields', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  workspaceId: bigint('workspace_id', { mode: 'number', unsigned: true }),
  name: varchar('name', { length: 191 }),
  type: varchar('type', { length: 50 }).notNull().default("text"),
  format: varchar('format', { length: 50 }),
  label: varchar('label', { length: 50 }),
  position: varchar('position', { length: 50 }).default("right"),
  decimal: varchar('decimal', { length: 50 }).default("0"),
  editable: tinyint('editable').notNull().default(0),
  notify: tinyint('notify').notNull().default(0),
  default: tinyint('default').notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type FieldsRow = typeof fields.$inferSelect;
export type NewFields = typeof fields.$inferInsert;

export const generalSettings = mysqlTable('general_settings', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  siteTitle: varchar('site_title', { length: 191 }),
  companyName: varchar('company_name', { length: 191 }),
  countryName: varchar('country_name', { length: 191 }),
  companyInfo: longtext('company_info'),
  contactLogin: tinyint('contact_login').notNull().default(0),
  fileSupported: text('file_supported'),
  zipCode: varchar('zip_code', { length: 191 }),
  vatNumber: varchar('vat_number', { length: 191 }),
  address: varchar('address', { length: 191 }),
  phone: varchar('phone', { length: 191 }),
  email: varchar('email', { length: 191 }),
  currency: varchar('currency', { length: 191 }).default("USD"),
  currencySymbol: varchar('currency_symbol', { length: 191 }).default("$"),
  promotionSetting: int('promotionSetting').default(0),
  logo: varchar('logo', { length: 191 }).notNull().default("public/uploads/settings/logo.png"),
  favicon: varchar('favicon', { length: 191 }).notNull().default("public/uploads/settings/favicon.png"),
  systemVersion: varchar('system_version', { length: 191 }).default("1.0"),
  activeStatus: int('active_status').default(1),
  currencyCode: varchar('currency_code', { length: 191 }).default("USD"),
  languageName: varchar('language_name', { length: 191 }).default("en"),
  systemPurchaseCode: varchar('system_purchase_code', { length: 191 }),
  systemActivatedDate: date('system_activated_date', { mode: 'string' }),
  envatoUser: varchar('envato_user', { length: 191 }),
  envatoItemId: varchar('envato_item_id', { length: 191 }),
  systemDomain: varchar('system_domain', { length: 191 }),
  copyrightText: varchar('copyright_text', { length: 191 }),
  websiteBtn: int('website_btn').notNull().default(1),
  dashboardBtn: int('dashboard_btn').notNull().default(1),
  reportBtn: int('report_btn').notNull().default(1),
  styleBtn: int('style_btn').notNull().default(1),
  ltlRtlBtn: int('ltl_rtl_btn').notNull().default(1),
  langBtn: int('lang_btn').notNull().default(1),
  websiteUrl: varchar('website_url', { length: 191 }),
  ttlRtl: int('ttl_rtl').notNull().default(2),
  phoneNumberPrivacy: int('phone_number_privacy').notNull().default(1),
  timeZoneId: int('time_zone_id'),
  languageId: int('language_id', { unsigned: true }).default(19),
  dateFormatId: int('date_format_id', { unsigned: true }).default(1),
  softwareVersion: varchar('software_version', { length: 100 }),
  mailSignature: varchar('mail_signature', { length: 191 }),
  mailHeader: longtext('mail_header'),
  mailFooter: longtext('mail_footer'),
  mailProtocol: varchar('mail_protocol', { length: 100 }),
  preloader: varchar('preloader', { length: 100 }).default("infix"),
  paymentGateway: int('payment_gateway').notNull().default(1),
  termsConditions: text('terms_conditions'),
  remarksTitle: varchar('remarks_title', { length: 200 }),
  remarksBody: text('remarks_body'),
  posView: int('pos_view'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  lastUpdatedDate: varchar('last_updated_date', { length: 191 }),
  loginBg: varchar('login_bg', { length: 191 }).notNull().default("public/backEnd/img/login-bg.png"),
  errorPageBg: varchar('error_page_bg', { length: 191 }).notNull().default("public/backEnd/img/login-bg.jpg"),
  defaultView: varchar('default_view', { length: 191 }).notNull().default("normal"),
});
export type GeneralSettingsRow = typeof generalSettings.$inferSelect;
export type NewGeneralSettings = typeof generalSettings.$inferInsert;

export const holidays = mysqlTable('holidays', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  year: year('year').notNull(),
  name: varchar('name', { length: 191 }),
  type: tinyint('type').notNull().default(0),
  date: varchar('date', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type HolidaysRow = typeof holidays.$inferSelect;
export type NewHolidays = typeof holidays.$inferInsert;

export const incomes = mysqlTable('incomes', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  voucherId: bigint('voucher_id', { mode: 'number', unsigned: true }),
  showroomId: bigint('showroom_id', { mode: 'number', unsigned: true }),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type IncomesRow = typeof incomes.$inferSelect;
export type NewIncomes = typeof incomes.$inferInsert;

export const introPrefix = mysqlTable('intro_prefix', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  prefix: varchar('prefix', { length: 191 }).notNull(),
  title: varchar('title', { length: 191 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type IntroPrefixRow = typeof introPrefix.$inferSelect;
export type NewIntroPrefix = typeof introPrefix.$inferInsert;

export const languagePhrases = mysqlTable('language_phrases', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  moduleId: bigint('module_id', { mode: 'number', unsigned: true }),
  pageName: varchar('page_name', { length: 191 }),
  defaultPhrases: text('default_phrases'),
  en: text('en'),
  es: text('es'),
  bn: text('bn'),
  fr: text('fr'),
  status: tinyint('status').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type LanguagePhrasesRow = typeof languagePhrases.$inferSelect;
export type NewLanguagePhrases = typeof languagePhrases.$inferInsert;

export const languages = mysqlTable('languages', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 191 }).notNull(),
  name: varchar('name', { length: 191 }).notNull(),
  native: varchar('native', { length: 191 }).notNull(),
  rtl: tinyint('rtl').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  jsonExist: tinyint('json_exist').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type LanguagesRow = typeof languages.$inferSelect;
export type NewLanguages = typeof languages.$inferInsert;

export const leaveDefines = mysqlTable('leave_defines', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  roleId: bigint('role_id', { mode: 'number', unsigned: true }).notNull(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  leaveTypeId: bigint('leave_type_id', { mode: 'number', unsigned: true }).notNull(),
  totalDays: int('total_days').notNull().default(0),
  maxForward: int('max_forward').notNull().default(0),
  balanceForward: tinyint('balance_forward').notNull().default(0),
  adjusted: tinyint('adjusted').notNull().default(0),
  year: year('year'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type LeaveDefinesRow = typeof leaveDefines.$inferSelect;
export type NewLeaveDefines = typeof leaveDefines.$inferInsert;

export const leaveTypes = mysqlTable('leave_types', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  status: tinyint('status').notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type LeaveTypesRow = typeof leaveTypes.$inferSelect;
export type NewLeaveTypes = typeof leaveTypes.$inferInsert;

export const logActivity = mysqlTable('log_activity', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  subject: varchar('subject', { length: 191 }).notNull(),
  type: tinyint('type').notNull().default(1),
  url: varchar('url', { length: 191 }),
  method: varchar('method', { length: 191 }),
  ip: varchar('ip', { length: 191 }),
  login: tinyint('login').notNull().default(0),
  loginTime: datetime('login_time', { mode: 'date' }),
  logoutTime: datetime('logout_time', { mode: 'date' }),
  agent: varchar('agent', { length: 191 }),
  userId: int('user_id'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type LogActivityRow = typeof logActivity.$inferSelect;
export type NewLogActivity = typeof logActivity.$inferInsert;

export const models = mysqlTable('models', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ModelsRow = typeof models.$inferSelect;
export type NewModels = typeof models.$inferInsert;

export const notifications = mysqlTable('notifications', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  type: varchar('type', { length: 191 }),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  role: varchar('role', { length: 191 }),
  notifiableType: varchar('notifiable_type', { length: 191 }).notNull(),
  notifiableId: bigint('notifiable_id', { mode: 'number', unsigned: true }).notNull(),
  data: text('data'),
  url: text('url'),
  readAt: timestamp('read_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type NotificationsRow = typeof notifications.$inferSelect;
export type NewNotifications = typeof notifications.$inferInsert;

export const openingBalanceHistories = mysqlTable('opening_balance_histories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }),
  accType: varchar('acc_type', { length: 80 }),
  date: date('date', { mode: 'string' }),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  isDefault: tinyint('is_default').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type OpeningBalanceHistoriesRow = typeof openingBalanceHistories.$inferSelect;
export type NewOpeningBalanceHistories = typeof openingBalanceHistories.$inferInsert;

export const partNumbers = mysqlTable('part_numbers', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }),
  productItemDetailId: bigint('product_item_detail_id', { mode: 'number', unsigned: true }),
  seiralNo: varchar('seiral_no', { length: 191 }),
  isSold: tinyint('is_sold').notNull().default(0),
  isReturned: tinyint('is_returned').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PartNumbersRow = typeof partNumbers.$inferSelect;
export type NewPartNumbers = typeof partNumbers.$inferInsert;

export const passwordResets = mysqlTable('password_resets', {
  email: varchar('email', { length: 191 }).notNull(),
  token: varchar('token', { length: 191 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
});
export type PasswordResetsRow = typeof passwordResets.$inferSelect;
export type NewPasswordResets = typeof passwordResets.$inferInsert;

export const paymentGateways = mysqlTable('payment_gateways', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  gatewayName: varchar('gateway_name', { length: 191 }),
  gatewayUsername: varchar('gateway_username', { length: 191 }),
  gatewayPassword: varchar('gateway_password', { length: 191 }),
  gatewaySignature: varchar('gateway_signature', { length: 191 }),
  gatewayClientId: varchar('gateway_client_id', { length: 191 }),
  gatewayMode: varchar('gateway_mode', { length: 191 }),
  gatewayApiKey: varchar('gateway_api_key', { length: 191 }),
  gatewaySecretKey: varchar('gateway_secret_key', { length: 191 }),
  gatewayPublisherKey: varchar('gateway_publisher_key', { length: 191 }),
  gatewayPrivateKey: varchar('gateway_private_key', { length: 191 }),
  redirectUrl: varchar('redirect_url', { length: 191 }),
  activeStatus: tinyint('active_status').notNull().default(1),
  bankDetails: text('bank_details'),
  chequeDetails: text('cheque_details'),
  createdBy: int('created_by', { unsigned: true }).default(1),
  updatedBy: int('updated_by', { unsigned: true }).default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PaymentGatewaysRow = typeof paymentGateways.$inferSelect;
export type NewPaymentGateways = typeof paymentGateways.$inferInsert;

export const payments = mysqlTable('payments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  payableId: bigint('payable_id', { mode: 'number', unsigned: true }).notNull(),
  payableType: varchar('payable_type', { length: 191 }),
  paymentMethod: varchar('payment_method', { length: 191 }),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  advanceAmount: double('advance_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  bankName: varchar('bank_name', { length: 191 }),
  branch: varchar('branch', { length: 191 }),
  accountNo: varchar('account_no', { length: 191 }),
  accountOwner: varchar('account_owner', { length: 191 }),
  cardType: varchar('card_type', { length: 191 }),
  cardNumber: varchar('card_number', { length: 191 }),
  cardHolder: varchar('card_holder', { length: 191 }),
  expiryDate: varchar('expiry_date', { length: 191 }),
  securityCode: varchar('security_code', { length: 191 }),
  returnAmount: double('return_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  initialPayment: tinyint('initial_payment').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PaymentsRow = typeof payments.$inferSelect;
export type NewPayments = typeof payments.$inferInsert;

export const payrollEarnDeducs = mysqlTable('payroll_earn_deducs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  typeName: varchar('type_name', { length: 191 }),
  amount: double('amount', { precision: 10, scale: 2 }),
  earnDedcType: varchar('earn_dedc_type', { length: 5 }),
  activeStatus: tinyint('active_status').notNull().default(1),
  loanStatus: tinyint('loan_status').notNull().default(0),
  payrollId: int('payroll_id', { unsigned: true }).notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PayrollEarnDeducsRow = typeof payrollEarnDeducs.$inferSelect;
export type NewPayrollEarnDeducs = typeof payrollEarnDeducs.$inferInsert;

export const payrolls = mysqlTable('payrolls', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  staffId: int('staff_id', { unsigned: true }).notNull().default(1),
  roleId: int('role_id', { unsigned: true }).notNull().default(1),
  basicSalary: double('basic_salary', { precision: 16, scale: 2 }),
  totalEarning: double('total_earning', { precision: 16, scale: 2 }),
  totalDeduction: double('total_deduction', { precision: 16, scale: 2 }),
  grossSalary: double('gross_salary', { precision: 16, scale: 2 }),
  tax: double('tax', { precision: 16, scale: 2 }),
  netSalary: double('net_salary', { precision: 16, scale: 2 }),
  payrollMonth: varchar('payroll_month', { length: 191 }),
  payrollYear: varchar('payroll_year', { length: 191 }),
  payrollStatus: varchar('payroll_status', { length: 191 }),
  paymentMode: varchar('payment_mode', { length: 191 }),
  paymentDate: date('payment_date', { mode: 'string' }),
  note: varchar('note', { length: 200 }),
  bankName: varchar('bank_name', { length: 191 }),
  bankBranchName: varchar('bank_branch_name', { length: 191 }),
  accountNo: varchar('account_no', { length: 191 }),
  chequeNo: varchar('cheque_no', { length: 191 }),
  activeStatus: tinyint('active_status').notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PayrollsRow = typeof payrolls.$inferSelect;
export type NewPayrolls = typeof payrolls.$inferInsert;

export const permissions = mysqlTable('permissions', {
  id: int('id').notNull(),
  moduleId: int('module_id'),
  parentId: int('parent_id'),
  name: varchar('name', { length: 191 }),
  route: varchar('route', { length: 191 }),
  status: tinyint('status').notNull().default(1),
  createdBy: int('created_by', { unsigned: true }).notNull().default(1),
  updatedBy: int('updated_by', { unsigned: true }).notNull().default(1),
  type: int('type'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PermissionsRow = typeof permissions.$inferSelect;
export type NewPermissions = typeof permissions.$inferInsert;

export const printers = mysqlTable('printers', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  connectionType: varchar('connection_type', { length: 191 }),
  charPerLine: varchar('char_per_line', { length: 191 }),
  ip: varchar('ip', { length: 191 }),
  port: varchar('port', { length: 191 }),
  path: varchar('path', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type PrintersRow = typeof printers.$inferSelect;
export type NewPrinters = typeof printers.$inferInsert;

export const productHistories = mysqlTable('product_histories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  type: varchar('type', { length: 191 }).notNull(),
  houseableId: bigint('houseable_id', { mode: 'number', unsigned: true }).notNull(),
  houseableType: varchar('houseable_type', { length: 191 }).notNull(),
  itemableId: bigint('itemable_id', { mode: 'number', unsigned: true }).notNull(),
  itemableType: varchar('itemable_type', { length: 191 }).notNull(),
  date: date('date', { mode: 'string' }),
  inOut: bigint('in_out', { mode: 'number', unsigned: true }).notNull(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }).notNull(),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProductHistoriesRow = typeof productHistories.$inferSelect;
export type NewProductHistories = typeof productHistories.$inferInsert;

export const productItemDetails = mysqlTable('product_item_details', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  itemableId: int('itemable_id', { unsigned: true }),
  itemableType: varchar('itemable_type', { length: 255 }),
  productableId: int('productable_id', { unsigned: true }),
  productableType: varchar('productable_type', { length: 255 }),
  productSkuId: int('product_sku_id', { unsigned: true }).notNull(),
  price: double('price', { precision: 16, scale: 2 }).notNull().default(0.00),
  quantity: int('quantity').notNull().default(0),
  tax: double('tax', { precision: 16, scale: 2 }).notNull().default(0.00),
  discount: double('discount', { precision: 16, scale: 2 }).notNull().default(0.00),
  subTotal: double('sub_total', { precision: 16, scale: 2 }).notNull().default(0.00),
  returnQuantity: int('return_quantity').notNull().default(0),
  returnAmount: double('return_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  returnDate: timestamp('return_date', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  status: tinyint('status').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  sellingPrice: double('selling_price', { precision: 16, scale: 2 }).notNull().default(0.00),
});
export type ProductItemDetailsRow = typeof productItemDetails.$inferSelect;
export type NewProductItemDetails = typeof productItemDetails.$inferInsert;

export const productItemDetailsPartNumbers = mysqlTable('product_item_details_part_numbers', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  partNumberId: int('part_number_id', { unsigned: true }),
  saleId: int('sale_id', { unsigned: true }),
  productItemDetailId: int('product_item_detail_id', { unsigned: true }),
  productSkuId: int('product_sku_id', { unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProductItemDetailsPartNumbersRow = typeof productItemDetailsPartNumbers.$inferSelect;
export type NewProductItemDetailsPartNumbers = typeof productItemDetailsPartNumbers.$inferInsert;

export const productSellingPriceHistories = mysqlTable('product_selling_price_histories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }),
  purchaseOrderId: bigint('purchase_order_id', { mode: 'number', unsigned: true }),
  oldPrice: double('old_price', { precision: 28, scale: 2 }).notNull().default(0.00),
  newSellingPrice: double('new_selling_price', { precision: 28, scale: 2 }).notNull().default(0.00),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProductSellingPriceHistoriesRow = typeof productSellingPriceHistories.$inferSelect;
export type NewProductSellingPriceHistories = typeof productSellingPriceHistories.$inferInsert;

export const productSku = mysqlTable('product_sku', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  productId: bigint('product_id', { mode: 'number', unsigned: true }),
  sku: varchar('sku', { length: 250 }),
  stockQuantity: bigint('stock_quantity', { mode: 'number', unsigned: true }),
  alertQuantity: bigint('alert_quantity', { mode: 'number', unsigned: true }),
  purchasePrice: double('purchase_price', { precision: 16, scale: 2 }).notNull().default(0.00),
  sellingPrice: double('selling_price', { precision: 16, scale: 2 }).notNull().default(0.00),
  minSellingPrice: int('min_selling_price').notNull().default(0),
  barcodeType: varchar('barcode_type', { length: 255 }),
  barcodeId: varchar('barcode_id', { length: 191 }),
  discountType: varchar('discount_type', { length: 50 }),
  discount: double('discount', { precision: 16, scale: 2 }).notNull().default(0.00),
  taxType: varchar('tax_type', { length: 50 }),
  tax: double('tax', { precision: 16, scale: 2 }).notNull().default(0.00),
  costOfGoods: double('cost_of_goods', { precision: 16, scale: 2 }).notNull().default(0.00),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProductSkuRow = typeof productSku.$inferSelect;
export type NewProductSku = typeof productSku.$inferInsert;

export const productVariations = mysqlTable('product_variations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  productId: bigint('product_id', { mode: 'number', unsigned: true }).notNull(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }),
  variantId: varchar('variant_id', { length: 191 }),
  variantValueId: varchar('variant_value_id', { length: 191 }),
  variants: text('variants'),
  imageSource: varchar('image_source', { length: 191 }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProductVariationsRow = typeof productVariations.$inferSelect;
export type NewProductVariations = typeof productVariations.$inferInsert;

export const products = mysqlTable('products', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  productName: varchar('product_name', { length: 191 }),
  productType: varchar('product_type', { length: 191 }),
  modelId: bigint('model_id', { mode: 'number', unsigned: true }),
  unitTypeId: bigint('unit_type_id', { mode: 'number', unsigned: true }),
  brandId: bigint('brand_id', { mode: 'number', unsigned: true }),
  categoryId: bigint('category_id', { mode: 'number', unsigned: true }),
  subCategoryId: bigint('sub_category_id', { mode: 'number', unsigned: true }),
  origin: varchar('origin', { length: 191 }),
  description: text('description'),
  imageSource: varchar('image_source', { length: 191 }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  productSku: varchar('product_sku', { length: 191 }),
  barcodeType: varchar('barcode_type', { length: 191 }),
  price: double('price', { precision: 16, scale: 2 }),
  priceOfOtherCurrency: varchar('price_of_other_currency', { length: 191 }),
  wareHouseId: bigint('ware_house_id', { mode: 'number', unsigned: true }),
  manageStock: tinyint('manage_stock').notNull().default(0),
  alertQuantity: varchar('alert_quantity', { length: 191 }),
});
export type ProductsRow = typeof products.$inferSelect;
export type NewProducts = typeof products.$inferInsert;

export const projectComments = mysqlTable('project_comments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  projectId: bigint('project_id', { mode: 'number', unsigned: true }),
  parentId: bigint('parent_id', { mode: 'number', unsigned: true }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  comment: longtext('comment'),
  pinTop: tinyint('pin_top').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProjectCommentsRow = typeof projectComments.$inferSelect;
export type NewProjectComments = typeof projectComments.$inferInsert;

export const projectTask = mysqlTable('project_task', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true }),
  projectId: bigint('project_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProjectTaskRow = typeof projectTask.$inferSelect;
export type NewProjectTask = typeof projectTask.$inferInsert;

export const projectUser = mysqlTable('project_user', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  projectId: bigint('project_id', { mode: 'number', unsigned: true }),
  icon: varchar('icon', { length: 191 }),
  color: varchar('color', { length: 191 }),
  favourite: tinyint('favourite').notNull().default(0),
  defaultView: varchar('default_view', { length: 191 }).notNull().default("list"),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProjectUserRow = typeof projectUser.$inferSelect;
export type NewProjectUser = typeof projectUser.$inferInsert;

export const projects = mysqlTable('projects', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  teamId: bigint('team_id', { mode: 'number', unsigned: true }),
  name: varchar('name', { length: 191 }),
  description: longtext('description'),
  privacy: int('privacy').notNull().default(1),
  defaultView: varchar('default_view', { length: 191 }).notNull().default("list"),
  uuid: char('uuid', { length: 36 }),
  dueDate: date('due_date', { mode: 'string' }).default("2022-02-09"),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ProjectsRow = typeof projects.$inferSelect;
export type NewProjects = typeof projects.$inferInsert;

export const purchaseOrders = mysqlTable('purchase_orders', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  supplierId: bigint('supplier_id', { mode: 'number', unsigned: true }).notNull(),
  purchasableId: bigint('purchasable_id', { mode: 'number', unsigned: true }).notNull(),
  cnfId: bigint('cnf_id', { mode: 'number', unsigned: true }),
  taxId: bigint('tax_id', { mode: 'number', unsigned: true }),
  purchasableType: varchar('purchasable_type', { length: 191 }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalQuantity: bigint('total_quantity', { mode: 'number', unsigned: false }).notNull().default(0),
  totalDiscount: double('total_discount', { precision: 16, scale: 2 }).notNull().default(0.00),
  discountAmount: double('discount_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  discountType: tinyint('discount_type').notNull().default(2),
  totalVat: double('total_vat', { precision: 16, scale: 2 }).notNull().default(0.00),
  shippingCharge: double('shipping_charge', { precision: 16, scale: 2 }).notNull().default(0.00),
  otherCharge: double('other_charge', { precision: 16, scale: 2 }).notNull().default(0.00),
  payableAmount: double('payable_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  paymentMethod: varchar('payment_method', { length: 191 }),
  invoiceNo: varchar('invoice_no', { length: 191 }).notNull(),
  refNo: varchar('ref_no', { length: 191 }),
  shippingAddress: varchar('shipping_address', { length: 191 }),
  documents: longtext('documents'),
  status: tinyint('status').notNull().default(0),
  returnStatus: tinyint('return_status').notNull().default(2),
  addedToStock: tinyint('added_to_stock').notNull().default(0),
  isPaid: tinyint('is_paid').notNull().default(0),
  notes: longtext('notes'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  lcNo: varchar('lc_no', { length: 191 }),
  cnfAgent: varchar('cnf_agent', { length: 191 }),
});
export type PurchaseOrdersRow = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrders = typeof purchaseOrders.$inferInsert;

export const quotations = mysqlTable('quotations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  customerId: bigint('customer_id', { mode: 'number', unsigned: true }),
  quotationableId: bigint('quotationable_id', { mode: 'number', unsigned: true }),
  quotationableType: varchar('quotationable_type', { length: 191 }),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  invoiceNo: varchar('invoice_no', { length: 191 }),
  refNo: varchar('ref_no', { length: 191 }),
  totalQuantity: double('total_quantity', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalDiscount: double('total_discount', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalVat: double('total_vat', { precision: 16, scale: 2 }).notNull().default(0.00),
  shippingCharge: double('shipping_charge', { precision: 16, scale: 2 }).notNull().default(0.00),
  otherCharge: double('other_charge', { precision: 16, scale: 2 }).notNull().default(0.00),
  payableAmount: double('payable_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  discountAmount: double('discount_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  discountType: tinyint('discount_type').notNull().default(1),
  date: timestamp('date', { mode: 'date' }),
  validTillDate: date('valid_till_date', { mode: 'string' }),
  shippingAddress: varchar('shipping_address', { length: 191 }),
  document: varchar('document', { length: 191 }),
  signature: varchar('signature', { length: 191 }),
  status: tinyint('status').notNull().default(0),
  convertStatus: tinyint('convert_status').notNull().default(0),
  notes: longtext('notes'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type QuotationsRow = typeof quotations.$inferSelect;
export type NewQuotations = typeof quotations.$inferInsert;

export const receiveProducts = mysqlTable('receive_products', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  purchaseId: bigint('purchase_id', { mode: 'number', unsigned: true }).notNull(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }).notNull(),
  receiveQuantity: int('receive_quantity').notNull().default(0),
  receiveDate: date('receive_date', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ReceiveProductsRow = typeof receiveProducts.$inferSelect;
export type NewReceiveProducts = typeof receiveProducts.$inferInsert;

export const rolePermission = mysqlTable('role_permission', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  permissionId: int('permission_id'),
  roleId: int('role_id', { unsigned: true }),
  status: tinyint('status').notNull().default(1),
  createdBy: int('created_by', { unsigned: true }).notNull().default(1),
  updatedBy: int('updated_by', { unsigned: true }).notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type RolePermissionRow = typeof rolePermission.$inferSelect;
export type NewRolePermission = typeof rolePermission.$inferInsert;

export const roles = mysqlTable('roles', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  type: varchar('type', { length: 191 }).notNull(),
  details: varchar('details', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type RolesRow = typeof roles.$inferSelect;
export type NewRoles = typeof roles.$inferInsert;

export const sales = mysqlTable('sales', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  customerId: bigint('customer_id', { mode: 'number', unsigned: true }),
  agentUserId: bigint('agent_user_id', { mode: 'number', unsigned: true }),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  saleableId: bigint('saleable_id', { mode: 'number', unsigned: true }),
  saleableType: varchar('saleable_type', { length: 191 }).notNull(),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalQuantity: double('total_quantity', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalDiscount: double('total_discount', { precision: 16, scale: 2 }).notNull().default(0.00),
  totalTax: double('total_tax', { precision: 16, scale: 2 }).notNull().default(0.00),
  taxId: bigint('tax_id', { mode: 'number', unsigned: true }),
  shippingCharge: double('shipping_charge', { precision: 16, scale: 2 }).notNull().default(0.00),
  otherCharge: double('other_charge', { precision: 16, scale: 2 }).notNull().default(0.00),
  payableAmount: double('payable_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  refNo: varchar('ref_no', { length: 191 }),
  invoiceNo: varchar('invoice_no', { length: 191 }),
  discountAmount: double('discount_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  discountType: tinyint('discount_type').notNull().default(1),
  mailStatus: tinyint('mail_status').notNull().default(0),
  status: tinyint('status').notNull().default(0),
  type: tinyint('type').notNull().default(0),
  isApproved: tinyint('is_approved').notNull().default(0),
  isDraft: tinyint('is_draft').notNull().default(0),
  date: date('date', { mode: 'string' }),
  notes: longtext('notes'),
  returnNote: longtext('return_note'),
  document: longtext('document'),
  signature: varchar('signature', { length: 191 }),
  returnDocument: longtext('return_document'),
  returnStatus: tinyint('return_status').notNull().default(2),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type SalesRow = typeof sales.$inferSelect;
export type NewSales = typeof sales.$inferInsert;

export const sections = mysqlTable('sections', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  projectId: bigint('project_id', { mode: 'number', unsigned: true }),
  name: varchar('name', { length: 191 }),
  order: smallint('order', { unsigned: true }).notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type SectionsRow = typeof sections.$inferSelect;
export type NewSections = typeof sections.$inferInsert;

export const selectedLanguages = mysqlTable('selected_languages', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  languageName: varchar('language_name', { length: 191 }),
  native: varchar('native', { length: 191 }),
  langId: bigint('lang_id', { mode: 'number', unsigned: true }),
  languageUniversal: varchar('language_universal', { length: 191 }),
  status: tinyint('status').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type SelectedLanguagesRow = typeof selectedLanguages.$inferSelect;
export type NewSelectedLanguages = typeof selectedLanguages.$inferInsert;

export const shippings = mysqlTable('shippings', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  saleId: bigint('sale_id', { mode: 'number', unsigned: true }),
  shippingName: varchar('shipping_name', { length: 191 }),
  shippingRef: varchar('shipping_ref', { length: 191 }),
  date: date('date', { mode: 'string' }),
  bookingSlip: varchar('booking_slip', { length: 191 }),
  proveOfDelivery: varchar('prove_of_delivery', { length: 191 }),
  receivedBy: varchar('received_by', { length: 191 }),
  receivedDate: date('received_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ShippingsRow = typeof shippings.$inferSelect;
export type NewShippings = typeof shippings.$inferInsert;

export const showRooms = mysqlTable('show_rooms', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: varchar('address', { length: 255 }),
  phone: varchar('phone', { length: 255 }),
  status: tinyint('status').notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ShowRoomsRow = typeof showRooms.$inferSelect;
export type NewShowRooms = typeof showRooms.$inferInsert;

export const smsGateways = mysqlTable('sms_gateways', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  status: tinyint('status').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type SmsGatewaysRow = typeof smsGateways.$inferSelect;
export type NewSmsGateways = typeof smsGateways.$inferInsert;

export const staffDocuments = mysqlTable('staff_documents', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  staffId: bigint('staff_id', { mode: 'number', unsigned: true }).notNull().default(1),
  name: varchar('name', { length: 255 }),
  documents: varchar('documents', { length: 255 }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type StaffDocumentsRow = typeof staffDocuments.$inferSelect;
export type NewStaffDocuments = typeof staffDocuments.$inferInsert;

export const staffs = mysqlTable('staffs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  employeeId: varchar('employee_id', { length: 50 }),
  userId: int('user_id', { unsigned: true }).default(1),
  departmentId: int('department_id', { unsigned: true }).default(1),
  showroomId: int('showroom_id', { unsigned: true }).default(1),
  warehouseId: int('warehouse_id', { unsigned: true }).default(1),
  phone: varchar('phone', { length: 20 }),
  bankName: varchar('bank_name', { length: 255 }),
  bankBranchName: varchar('bank_branch_name', { length: 255 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  bankAccountNo: varchar('bank_account_no', { length: 255 }),
  currentAddress: varchar('current_address', { length: 255 }),
  permanentAddress: varchar('permanent_address', { length: 255 }),
  basicSalary: varchar('basic_salary', { length: 255 }),
  employmentType: varchar('employment_type', { length: 150 }),
  openingBalance: double('opening_balance', { precision: 16, scale: 2 }).default(0.00),
  provisionalMonths: tinyint('provisional_months').notNull().default(0),
  dateOfJoining: date('date_of_joining', { mode: 'string' }),
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  leaveApplicableDate: date('leave_applicable_date', { mode: 'string' }),
  carryForward: int('carry_forward').notNull().default(0),
  isCarryActive: tinyint('is_carry_active').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type StaffsRow = typeof staffs.$inferSelect;
export type NewStaffs = typeof staffs.$inferInsert;

export const stockAdjustmentProducts = mysqlTable('stock_adjustment_products', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  stockAdjustmentId: bigint('stock_adjustment_id', { mode: 'number', unsigned: true }),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }),
  qty: bigint('qty', { mode: 'number', unsigned: true }).notNull().default(0),
  unitPrice: double('unit_price', { precision: 16, scale: 2 }).notNull().default(0.00),
  subtotal: double('subtotal', { precision: 16, scale: 2 }).notNull().default(0.00),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type StockAdjustmentProductsRow = typeof stockAdjustmentProducts.$inferSelect;
export type NewStockAdjustmentProducts = typeof stockAdjustmentProducts.$inferInsert;

export const stockAdjustments = mysqlTable('stock_adjustments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  adjustableId: bigint('adjustable_id', { mode: 'number', unsigned: true }),
  adjustableType: varchar('adjustable_type', { length: 191 }),
  refNo: varchar('ref_no', { length: 191 }),
  reason: text('reason'),
  date: date('date', { mode: 'string' }),
  recoveryAmount: double('recovery_amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  status: tinyint('status').notNull().default(0),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type StockAdjustmentsRow = typeof stockAdjustments.$inferSelect;
export type NewStockAdjustments = typeof stockAdjustments.$inferInsert;

export const stockReports = mysqlTable('stock_reports', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  houseableId: bigint('houseable_id', { mode: 'number', unsigned: true }).notNull(),
  houseableType: varchar('houseable_type', { length: 191 }).notNull(),
  stockDate: date('stock_date', { mode: 'string' }).notNull(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }).notNull(),
  stock: varchar('stock', { length: 191 }).notNull().default("0"),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type StockReportsRow = typeof stockReports.$inferSelect;
export type NewStockReports = typeof stockReports.$inferInsert;

export const stockTransfers = mysqlTable('stock_transfers', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  sendableId: bigint('sendable_id', { mode: 'number', unsigned: true }).notNull(),
  sendableType: varchar('sendable_type', { length: 191 }).notNull(),
  receivableId: bigint('receivable_id', { mode: 'number', unsigned: true }).notNull(),
  receivableType: varchar('receivable_type', { length: 191 }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  status: tinyint('status').notNull().default(0),
  sentAt: date('sent_at', { mode: 'string' }),
  receivedAt: date('received_at', { mode: 'string' }),
  documents: longtext('documents'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type StockTransfersRow = typeof stockTransfers.$inferSelect;
export type NewStockTransfers = typeof stockTransfers.$inferInsert;

export const suggestLists = mysqlTable('suggest_lists', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  houseableId: bigint('houseable_id', { mode: 'number', unsigned: true }).notNull(),
  houseableType: varchar('houseable_type', { length: 191 }).notNull(),
  productSkuId: bigint('product_sku_id', { mode: 'number', unsigned: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type SuggestListsRow = typeof suggestLists.$inferSelect;
export type NewSuggestLists = typeof suggestLists.$inferInsert;

export const tagTask = mysqlTable('tag_task', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true }),
  tagId: bigint('tag_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TagTaskRow = typeof tagTask.$inferSelect;
export type NewTagTask = typeof tagTask.$inferInsert;

export const tags = mysqlTable('tags', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  workspaceId: bigint('workspace_id', { mode: 'number', unsigned: true }),
  name: varchar('name', { length: 191 }),
  color: varchar('color', { length: 50 }).notNull().default("text"),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TagsRow = typeof tags.$inferSelect;
export type NewTags = typeof tags.$inferInsert;

export const taskCommentLikes = mysqlTable('task_comment_likes', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  taskCommentId: bigint('task_comment_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TaskCommentLikesRow = typeof taskCommentLikes.$inferSelect;
export type NewTaskCommentLikes = typeof taskCommentLikes.$inferInsert;

export const taskComments = mysqlTable('task_comments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  event: varchar('event', { length: 191 }),
  fieldId: bigint('field_id', { mode: 'number', unsigned: true }),
  taskId: bigint('task_id', { mode: 'number', unsigned: true }),
  oldId: bigint('old_id', { mode: 'number', unsigned: true }),
  newId: bigint('new_id', { mode: 'number', unsigned: true }),
  tableType: varchar('table_type', { length: 255 }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  comment: longtext('comment'),
  oldValue: longtext('old_value'),
  pinTop: tinyint('pin_top').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TaskCommentsRow = typeof taskComments.$inferSelect;
export type NewTaskComments = typeof taskComments.$inferInsert;

export const taskDependencies = mysqlTable('task_dependencies', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true }),
  direction: tinyint('direction').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TaskDependenciesRow = typeof taskDependencies.$inferSelect;
export type NewTaskDependencies = typeof taskDependencies.$inferInsert;

export const taskLikes = mysqlTable('task_likes', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  taskId: bigint('task_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TaskLikesRow = typeof taskLikes.$inferSelect;
export type NewTaskLikes = typeof taskLikes.$inferInsert;

export const tasks = mysqlTable('tasks', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  uuid: char('uuid', { length: 36 }),
  projectId: bigint('project_id', { mode: 'number', unsigned: true }),
  sectionId: bigint('section_id', { mode: 'number', unsigned: true }),
  parentId: bigint('parent_id', { mode: 'number', unsigned: true }),
  name: text('name'),
  completed: tinyint('completed').notNull().default(0),
  description: longtext('description'),
  order: smallint('order', { unsigned: true }).notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TasksRow = typeof tasks.$inferSelect;
export type NewTasks = typeof tasks.$inferInsert;

export const taxes = mysqlTable('taxes', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  description: text('description'),
  rate: double('rate').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TaxesRow = typeof taxes.$inferSelect;
export type NewTaxes = typeof taxes.$inferInsert;

export const teamUser = mysqlTable('team_user', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  teamId: bigint('team_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TeamUserRow = typeof teamUser.$inferSelect;
export type NewTeamUser = typeof teamUser.$inferInsert;

export const teams = mysqlTable('teams', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  uuid: char('uuid', { length: 36 }),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  workspaceId: bigint('workspace_id', { mode: 'number', unsigned: true }),
  name: varchar('name', { length: 191 }),
  description: text('description'),
  privacyType: int('privacy_type').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TeamsRow = typeof teams.$inferSelect;
export type NewTeams = typeof teams.$inferInsert;

export const themes = mysqlTable('themes', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  title: varchar('title', { length: 191 }),
  colorMode: varchar('color_mode', { length: 191 }).notNull().default("gradient"),
  backgroundType: varchar('background_type', { length: 191 }).notNull().default("image"),
  backgroundColor: varchar('background_color', { length: 191 }).notNull().default("#fffff"),
  backgroundImage: varchar('background_image', { length: 191 }).notNull().default("/public/backEnd/img/body-bg.jpg"),
  isDefault: tinyint('is_default').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ThemesRow = typeof themes.$inferSelect;
export type NewThemes = typeof themes.$inferInsert;

export const timePeriodAccounts = mysqlTable('time_period_accounts', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  startDate: date('start_date', { mode: 'string' }),
  endDate: date('end_date', { mode: 'string' }),
  isClosed: tinyint('is_closed').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TimePeriodAccountsRow = typeof timePeriodAccounts.$inferSelect;
export type NewTimePeriodAccounts = typeof timePeriodAccounts.$inferInsert;

export const timeZones = mysqlTable('time_zones', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 191 }),
  timeZone: varchar('time_zone', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TimeZonesRow = typeof timeZones.$inferSelect;
export type NewTimeZones = typeof timeZones.$inferInsert;

export const toDos = mysqlTable('to_dos', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  title: varchar('title', { length: 191 }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  status: tinyint('status').notNull(),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type ToDosRow = typeof toDos.$inferSelect;
export type NewToDos = typeof toDos.$inferInsert;

export const tranactionAccount = mysqlTable('tranaction_account', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }).notNull(),
  tranactionId: bigint('tranaction_id', { mode: 'number', unsigned: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TranactionAccountRow = typeof tranactionAccount.$inferSelect;
export type NewTranactionAccount = typeof tranactionAccount.$inferInsert;

export const transactions = mysqlTable('transactions', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }).notNull(),
  type: varchar('type', { length: 191 }),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  narration: varchar('narration', { length: 191 }),
  voucherableType: varchar('voucherable_type', { length: 191 }).notNull(),
  voucherableId: bigint('voucherable_id', { mode: 'number', unsigned: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TransactionsRow = typeof transactions.$inferSelect;
export type NewTransactions = typeof transactions.$inferInsert;

export const typeOpeningBalances = mysqlTable('type_opening_balances', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }),
  type: varchar('type', { length: 255 }),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  isDefault: tinyint('is_default').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type TypeOpeningBalancesRow = typeof typeOpeningBalances.$inferSelect;
export type NewTypeOpeningBalances = typeof typeOpeningBalances.$inferInsert;

export const unitTypes = mysqlTable('unit_types', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type UnitTypesRow = typeof unitTypes.$inferSelect;
export type NewUnitTypes = typeof unitTypes.$inferInsert;

export const uploads = mysqlTable('uploads', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  uuid: char('uuid', { length: 36 }),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  module: varchar('module', { length: 191 }),
  moduleId: int('module_id'),
  uploadToken: char('upload_token', { length: 36 }),
  userFilename: varchar('user_filename', { length: 191 }),
  filename: varchar('filename', { length: 191 }),
  fileType: varchar('file_type', { length: 191 }),
  isTempDelete: tinyint('is_temp_delete').notNull().default(0),
  status: tinyint('status').notNull().default(0),
  options: text('options'),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type UploadsRow = typeof uploads.$inferSelect;
export type NewUploads = typeof uploads.$inferInsert;

export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  contactId: varchar('contact_id', { length: 191 }),
  name: varchar('name', { length: 191 }).notNull(),
  username: varchar('username', { length: 191 }),
  photo: varchar('photo', { length: 191 }),
  roleId: bigint('role_id', { mode: 'number', unsigned: true }).notNull(),
  mobileVerifiedAt: timestamp('mobile_verified_at', { mode: 'date' }),
  email: varchar('email', { length: 191 }),
  emailVerifiedAt: timestamp('email_verified_at', { mode: 'date' }),
  password: varchar('password', { length: 191 }).notNull(),
  notificationPreference: varchar('notification_preference', { length: 191 }).notNull().default("mail"),
  isActive: tinyint('is_active').notNull().default(1),
  avatar: varchar('avatar', { length: 191 }),
  rememberToken: varchar('remember_token', { length: 100 }),
  currentWorkspaceId: bigint('current_workspace_id', { mode: 'number', unsigned: true }).default(1),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  signature: varchar('signature', { length: 191 }),
});
export type UsersRow = typeof users.$inferSelect;
export type NewUsers = typeof users.$inferInsert;

export const variantValues = mysqlTable('variant_values', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  value: varchar('value', { length: 50 }).notNull(),
  variantId: bigint('variant_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
  used: tinyint('used').notNull().default(0),
});
export type VariantValuesRow = typeof variantValues.$inferSelect;
export type NewVariantValues = typeof variantValues.$inferInsert;

export const variants = mysqlTable('variants', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  status: tinyint('status').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type VariantsRow = typeof variants.$inferSelect;
export type NewVariants = typeof variants.$inferInsert;

export const versionHistories = mysqlTable('version_histories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  version: varchar('version', { length: 191 }),
  releaseDate: varchar('release_date', { length: 191 }),
  url: varchar('url', { length: 191 }),
  notes: varchar('notes', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type VersionHistoriesRow = typeof versionHistories.$inferSelect;
export type NewVersionHistories = typeof versionHistories.$inferInsert;

export const vouchers = mysqlTable('vouchers', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  txId: varchar('tx_id', { length: 191 }),
  voucherType: varchar('voucher_type', { length: 191 }),
  referableId: bigint('referable_id', { mode: 'number', unsigned: true }),
  accountType: bigint('account_type', { mode: 'number', unsigned: true }),
  accountId: bigint('account_id', { mode: 'number', unsigned: true }),
  referableType: varchar('referable_type', { length: 255 }),
  amount: double('amount', { precision: 16, scale: 2 }).notNull().default(0.00),
  paymentType: varchar('payment_type', { length: 191 }),
  narration: varchar('narration', { length: 191 }),
  isApprove: tinyint('is_approve').notNull().default(1),
  isTransfer: tinyint('is_transfer').notNull().default(0),
  date: date('date', { mode: 'string' }),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type VouchersRow = typeof vouchers.$inferSelect;
export type NewVouchers = typeof vouchers.$inferInsert;

export const wareHouses = mysqlTable('ware_houses', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: varchar('address', { length: 255 }),
  phone: varchar('phone', { length: 255 }),
  status: tinyint('status').notNull().default(1),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type WareHousesRow = typeof wareHouses.$inferSelect;
export type NewWareHouses = typeof wareHouses.$inferInsert;

export const workspaces = mysqlTable('workspaces', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  name: varchar('name', { length: 191 }),
  defaultWorkspace: tinyint('default_workspace').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});
export type WorkspacesRow = typeof workspaces.$inferSelect;
export type NewWorkspaces = typeof workspaces.$inferInsert;
