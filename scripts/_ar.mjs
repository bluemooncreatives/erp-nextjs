// Writes a real Arabic pack for the phrases the interface actually shows.
//
// The `ar` files this port inherited are not Arabic: 175 keys of which 14
// differ from English, and those fourteen are typo corrections ("Recieve" ->
// "Receive"). So switching to Arabic translated nothing. These are Modern
// Standard Arabic terms as used in accounting and ERP software.
//
//   node scripts/_ar.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const AR = {
  // --- chrome and common nouns ---------------------------------------------
  'Dashboard': 'لوحة التحكم',
  'Home': 'الرئيسية',
  'Name': 'الاسم',
  'Date': 'التاريخ',
  'Amount': 'المبلغ',
  'Total': 'الإجمالي',
  'Status': 'الحالة',
  'Type': 'النوع',
  'Code': 'الرمز',
  'Title': 'العنوان',
  'Note': 'ملاحظة',
  'Description': 'الوصف',
  'Details': 'التفاصيل',
  'Reference': 'المرجع',
  'Image': 'الصورة',
  'Avatar': 'الصورة الشخصية',
  'Documents': 'المستندات',
  'Document Title': 'عنوان المستند',
  'Signature': 'التوقيع',
  'General': 'عام',
  'Settings': 'الإعدادات',
  'Profile': 'الملف الشخصي',
  'Edit Profile': 'تعديل الملف الشخصي',
  'Language': 'اللغة',
  'Language List': 'قائمة اللغات',
  'Notifications': 'الإشعارات',
  'Mark selected as seen': 'تعليم المحدد كمقروء',
  'Activity Logs': 'سجلات النشاط',
  'All Activity Logs': 'كل سجلات النشاط',
  'Login Activity': 'نشاط الدخول',
  'Backup': 'النسخ الاحتياطي',
  'Database Backup List': 'قائمة النسخ الاحتياطي',
  'Upload SQL File': 'رفع ملف SQL',
  'Change View': 'تغيير العرض',
  'Normal View': 'عرض عادي',
  'Compact View': 'عرض مضغوط',
  'Print': 'طباعة',
  'Printer': 'الطابعة',
  'Add Printer': 'إضافة طابعة',
  'Intro Prefix': 'بادئة الترقيم',
  'Add Intro Prefix': 'إضافة بادئة ترقيم',

  // --- actions --------------------------------------------------------------
  'Add': 'إضافة',
  'Save': 'حفظ',
  'Submit': 'إرسال',
  'Update': 'تحديث',
  'Edit': 'تعديل',
  'Delete': 'حذف',
  'Cancel': 'إلغاء',
  'Close': 'إغلاق',
  'Search': 'بحث',
  'Select': 'اختر',
  'Select one': 'اختر واحداً',
  'Open': 'فتح',
  'Complete': 'إكمال',
  'Approve': 'اعتماد',
  'Approval': 'الاعتماد',
  'Upload Document': 'رفع مستند',

  // --- people and contacts --------------------------------------------------
  'User': 'المستخدم',
  'Username': 'اسم المستخدم',
  'Password': 'كلمة المرور',
  'New Password': 'كلمة المرور الجديدة',
  'Current Password': 'كلمة المرور الحالية',
  'Confirm Password': 'تأكيد كلمة المرور',
  'Change Password': 'تغيير كلمة المرور',
  'Reset Password': 'إعادة تعيين كلمة المرور',
  'Login to your account': 'تسجيل الدخول إلى حسابك',
  'Role': 'الدور',
  'Staff': 'الموظفون',
  'Staff ID': 'رقم الموظف',
  'Add Staff': 'إضافة موظف',
  'Human Resource': 'الموارد البشرية',
  'Contacts': 'جهات الاتصال',
  'Add Contact': 'إضافة جهة اتصال',
  'Add Contacts': 'إضافة جهات اتصال',
  'Contact Type': 'نوع جهة الاتصال',
  'Customer': 'العميل',
  'Customers': 'العملاء',
  'Customer Group': 'مجموعة العملاء',
  'Supplier': 'المورّد',
  'Suppliers': 'الموردون',
  'Business Name': 'اسم النشاط',
  'Email': 'البريد الإلكتروني',
  'Phone': 'الهاتف',
  'Mobile': 'الجوال',
  'Alternate Contact No': 'رقم اتصال بديل',
  'Address': 'العنوان',
  'Current Address': 'العنوان الحالي',
  'Permanent Address': 'العنوان الدائم',
  'Date of Birth': 'تاريخ الميلاد',
  'Date of Joining': 'تاريخ الالتحاق',
  'Employment Type': 'نوع التوظيف',
  'My Details': 'بياناتي',
  'Credit Limit': 'حد الائتمان',
  'Pay Term': 'مدة السداد',
  'Pay Term Condition': 'شرط مدة السداد',

  // --- products and stock ---------------------------------------------------
  'Products': 'المنتجات',
  'Product List': 'قائمة المنتجات',
  'Product Name': 'اسم المنتج',
  'Add Product': 'إضافة منتج',
  'Edit Product': 'تعديل منتج',
  'Brand': 'العلامة التجارية',
  'Model': 'الطراز',
  'Category': 'الفئة',
  'Sub Category': 'الفئة الفرعية',
  'Variant': 'المتغيّر',
  'Unit Type': 'وحدة القياس',
  'Barcode Type': 'نوع الباركود',
  'Alert Quantity': 'حد التنبيه',
  'Selling Price': 'سعر البيع',
  'Min. Selling Price': 'أدنى سعر بيع',
  'Selling Price History': 'سجل أسعار البيع',
  'Combo Selling Price': 'سعر بيع المجموعة',
  'Purchase Price': 'سعر الشراء',
  'Hourly Rate': 'الأجر بالساعة',
  'Price of Other Currency': 'السعر بعملة أخرى',
  'Stock List': 'قائمة المخزون',
  'Stock Transfer': 'تحويل المخزون',
  'Stock Adjustment': 'تسوية المخزون',
  'Add Opening Stock': 'إضافة رصيد افتتاحي للمخزون',
  'Recieve Product': 'استلام المنتجات',

  // --- sales, purchases, money ----------------------------------------------
  'Purchase': 'المشتريات',
  'Invoice': 'الفاتورة',
  'Invoice No': 'رقم الفاتورة',
  'Payments': 'المدفوعات',
  'Add Recieve': 'إضافة مقبوضات',
  'Due': 'المستحق',
  'Return': 'المرتجعات',
  'Transaction': 'الحركة',
  'Transactions': 'الحركات',
  'Account Name': 'اسم الحساب',
  'Opening Balance': 'الرصيد الافتتاحي',
  'Opening Balance Add': 'إضافة رصيد افتتاحي',
  'Bank Name': 'اسم البنك',
  'Bank Branch Name': 'اسم فرع البنك',
  'Branch Name': 'اسم الفرع',
  'Currency': 'العملة',
  'Tax': 'الضريبة',
  'Tax Number': 'الرقم الضريبي',
  'Tax Type': 'نوع الضريبة',
  'Net Profit': 'صافي الربح',

  // --- payroll and leave ----------------------------------------------------
  'Basic Salary': 'الراتب الأساسي',
  'Monthly Installment': 'القسط الشهري',
  'Total Month': 'إجمالي الأشهر',
  'Apply Date': 'تاريخ الطلب',
  'Apply For Loan': 'طلب قرض',
  'Loan Apply': 'طلب قرض',
  'Loan Approval': 'اعتماد القرض',
  'Loan Date': 'تاريخ القرض',
  'Attendance': 'الحضور',
  'Date From': 'من تاريخ',
  'Clear': 'مسح',
  'Today Total Income': 'إجمالي إيرادات اليوم',
  'Today Total Expense': 'إجمالي مصروفات اليوم',
  'Today Closing Balance': 'رصيد إقفال اليوم',
  'Cashbook': 'دفتر النقدية',
  'Credit / Income': 'دائن / إيراد',
  'Debit / Expense': 'مدين / مصروف',
  'Income': 'الإيرادات',
  'Expenses': 'المصروفات',
  'Balance': 'الرصيد',
  'Debit': 'مدين',
  'Credit': 'دائن',
  'Voucher': 'سند',
  'Vouchers': 'السندات',
  'Journal': 'قيد يومية',
  'Receipt': 'سند قبض',
  'Payment': 'سند صرف',
  'Contra': 'قيد تحويل',
  'From Date': 'من تاريخ',
  'To Date': 'إلى تاريخ',
  'Action': 'الإجراء',
  'View': 'عرض',
  'Download': 'تنزيل',
  'Active': 'نشط',
  'Inactive': 'غير نشط',
  'Yes': 'نعم',
  'No': 'لا',
  'All': 'الكل',
  'None': 'لا شيء',
  'Employee': 'الموظف',
  'Designation': 'المسمى الوظيفي',
  'Salary': 'الراتب',
  'Month': 'الشهر',
  'Year': 'السنة',
  'Day': 'اليوم',
  'Start Date': 'تاريخ البداية',
  'End Date': 'تاريخ النهاية',
  'Reason': 'السبب',
  'Attachment': 'المرفق',
  'Holidays': 'العطلات',
  'Events': 'الأحداث',
  'To Do': 'المهام',
  'Order': 'الطلب',
  'Orders': 'الطلبات',
  'Shipping': 'الشحن',
  'Received': 'المستلم',
  'Approve Leave Request': 'اعتماد طلب الإجازة',
  'Pending Leave': 'الإجازات المعلقة',
  'Leave Type': 'نوع الإجازة',
  'Leave Define': 'تعريف الإجازات',
  'Carry Forward': 'الترحيل',
  'Holiday Setup': 'إعداد العطلات',
};

// Phrases whose group is not `common` but which appear on screen.
const EXTRA = {
  'Sale': 'المبيعات',
  'Sale Return': 'مرتجع المبيعات',
  'Sale on Condition': 'بيع بشرط',
  'Purchase Return': 'مرتجع المشتريات',
  'Quotation': 'عروض الأسعار',
  'Inventory': 'المخزون',
  'Accounts': 'الحسابات',
  'Reports': 'التقارير',
  'Location': 'المواقع',
  'Leave': 'الإجازات',
  'System Settings': 'إعدادات النظام',
  'Project Management': 'إدارة المشاريع',
  'Cashbook': 'دفتر النقدية',
  'Statement': 'كشف الحساب',
  'Chart Of Accounts': 'شجرة الحسابات',
  'Bank Accounts': 'الحسابات البنكية',
  'Account Balance': 'رصيد الحساب',
  'Income Lists': 'قائمة الإيرادات',
  'Expense': 'المصروفات',
  'Payroll': 'الرواتب',
  'Holiday': 'العطلات',
  'Department': 'القسم',
  'Credit / Income': 'دائن / إيراد',
  'Debit / Expense': 'مدين / مصروف',
  'Summary': 'الملخص',
  'Narration': 'البيان',
  'Branch': 'الفرع',
  'Paid': 'المدفوع',
  'Unpaid': 'غير مدفوع',
  'Partial': 'جزئي',
  'Approved': 'معتمد',
  'Pending': 'قيد الانتظار',
  'Rejected': 'مرفوض',
  'Actions': 'الإجراءات',
  'Payable': 'المستحق الدفع',
  'Customer Name': 'اسم العميل',
  'Quantity': 'الكمية',
  'Discount': 'الخصم',
  'Add Sale': 'إضافة عملية بيع',
  'Add Purchase': 'إضافة عملية شراء',
  'Sales': 'المبيعات',
  'Warehouse': 'المستودع',
  'Showroom': 'المعرض',
};

// The port shows some text the Blade never did, so `lang/default` has no key
// for it. These are added to `common` on both sides: the English goes in
// `default` so a translator can find it, the Arabic in `ar`.
const NEW_KEYS = {
  'Home': 'الرئيسية',
  'Summary': 'الملخص',
  'Project Management': 'إدارة المشاريع',
  'Projects': 'المشاريع',
  'Teams': 'الفرق',
  'Setup': 'الإعداد',
  'Currencies': 'العملات',
  'Today Balance / Cash in Hand': 'رصيد اليوم / النقد بالصندوق',
  'Matching records': 'السجلات المطابقة',
  'Showing now': 'المعروض الآن',
  'Records on this page': 'السجلات في هذه الصفحة',
  'Across all result pages': 'عبر كل صفحات النتائج',
  'Value on this page': 'القيمة في هذه الصفحة',
  'Apply filters': 'تطبيق عوامل التصفية',
  'Previous': 'السابق',
  'Next': 'التالي',
};

const ALL = { ...AR, ...EXTRA, ...NEW_KEYS };

const LANG = path.join(process.cwd(), 'lang');
const groups = readdirSync(path.join(LANG, 'default')).map((f) => f.slice(0, -5));

const arDir = path.join(LANG, 'ar');
if (!existsSync(arDir)) mkdirSync(arDir, { recursive: true });

// Add the port's own phrases to `common` first, so the loop below treats them
// like any other key.
const commonDefault = path.join(LANG, 'default', 'common.json');
const commonPhrases = JSON.parse(readFileSync(commonDefault, 'utf8'));
let added = 0;
for (const phrase of Object.keys(NEW_KEYS)) {
  if (!(phrase in commonPhrases)) {
    commonPhrases[phrase] = phrase;
    added += 1;
  }
}
if (added) {
  writeFileSync(commonDefault, `${JSON.stringify(commonPhrases, null, 2)}
`, 'utf8');
}

let written = 0;
let translated = 0;

for (const group of groups) {
  const defaults = JSON.parse(
    readFileSync(path.join(LANG, 'default', `${group}.json`), 'utf8'),
  );
  const target = path.join(arDir, `${group}.json`);
  const existing = existsSync(target)
    ? JSON.parse(readFileSync(target, 'utf8'))
    : {};

  const out = { ...defaults, ...existing };
  let touched = false;

  for (const key of Object.keys(defaults)) {
    if (typeof defaults[key] !== 'string') continue;
    const arabic = ALL[key];
    // Only fill in what is still the untranslated English source, so a real
    // translation already in the file is never overwritten.
    if (arabic && out[key] === defaults[key]) {
      out[key] = arabic;
      touched = true;
      translated += 1;
    }
  }

  if (touched || !existsSync(target)) {
    writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    written += 1;
  }
}

console.log(`added ${added} new default keys; wrote ${written} ar files, ${translated} phrases translated`);
