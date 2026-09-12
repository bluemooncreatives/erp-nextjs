// ---------------------------------------------------------------------------
// Contact writes - port of Modules/Contact/Repositories/ContactRepository.php.
//
// Creating a contact does three things, in this order:
//   1. the `contacts` row (its `contact_id` prefix is set from `intro_prefix`)
//   2. an optional login (`users`), only when `general_settings.contact_login`
//   3. a ChartAccount under the Customer (5) or Supplier (8) parent, whose
//      `code` is then rewritten as `0<type>-<parent padded to 2>-<id>`
// plus the opening-balance rows when a balance was entered.
// ---------------------------------------------------------------------------

import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import { chartAccounts, contacts, purchaseOrders, sales, users } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { hashPassword } from '@/lib/auth/password';
import { deleteStoredFile } from '@/lib/uploads';
import { generalSetting, IntroPrefixId, introPrefixFor } from '@/lib/settings';
import { openAccountingPeriod } from '@/lib/accounting/periods';
import {
  createOpeningBalanceForContact,
  createOpeningBalanceHistory,
  openingBalanceControlAccountId,
} from '@/lib/accounting/opening-balance';
import { AccountType } from '@/lib/accounting/accounts';
import { ContactType } from './queries';
import { today } from '@/lib/php-date';

/** Chart-of-accounts parents seeded by the installer. */
const CUSTOMER_PARENT_ACCOUNT_ID = 5;
const SUPPLIER_PARENT_ACCOUNT_ID = 8;

/** Role ids the contact login is created against. */
const SUPPLIER_ROLE_ID = 4;
const CUSTOMER_ROLE_ID = 5;

export type ContactInput = {
  contactType: 'Customer' | 'Supplier';
  name: string;
  businessName?: string | null;
  taxNumber?: string | null;
  openingBalance?: string | null;
  payTerm?: string | null;
  payTermCondition?: string | null;
  customerGroup?: string | null;
  creditLimit?: string | null;
  email?: string | null;
  username?: string | null;
  mobile?: string | null;
  alternateContactNo?: string | null;
  countryId?: number | null;
  state?: string | null;
  city?: string | null;
  note?: string | null;
  address?: string | null;
  avatar?: string | null;
  /** Only used when `contact_login` is on. */
  password?: string | null;
};

/**
 * `ContactModel::boot()`:
 *   customer -> IntroPrefix 6 ('CUS') + '-1' + 5-digit id
 *   supplier -> IntroPrefix 7 ('SUP') + '-2' + 5-digit id
 */
async function contactCode(id: number, type: string): Promise<string> {
  const isCustomer = type === ContactType.Customer;
  const prefix = await introPrefixFor(
    isCustomer ? IntroPrefixId.Customer : IntroPrefixId.Supplier,
  );
  const padded = String(id).padStart(5, '0');
  const marker = isCustomer ? '1' : '2';
  return `${prefix ?? (isCustomer ? 'CUS' : 'SUP')}-${marker}${padded}`;
}

/** `ContactRepository::create($data)` */
export async function createContact(
  data: ContactInput,
  userId?: number | null,
): Promise<number> {
  const setting = await generalSetting();
  const period = await openAccountingPeriod();

  const contactId = await runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(contacts).values({
      contactType: data.contactType,
      name: data.name,
      businessName: data.businessName ?? null,
      taxNumber: data.taxNumber ?? null,
      openingBalance: data.openingBalance ?? '0',
      payTerm: data.payTerm ?? null,
      payTermCondition: data.payTermCondition ?? '',
      customerGroup: data.customerGroup ?? null,
      creditLimit: data.creditLimit ?? null,
      email: data.email ?? null,
      username: data.username ?? null,
      mobile: data.mobile ?? null,
      alternateContactNo: data.alternateContactNo ?? null,
      countryId: data.countryId ?? null,
      state: data.state ?? null,
      city: data.city ?? null,
      note: data.note ?? null,
      address: data.address ?? null,
      avatar: data.avatar ?? null,
      isActive: 1,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const id = Number(inserted.insertId);

    // The model's `created` hook stamped the human-readable contact code.
    await tx
      .update(contacts)
      .set({ contactId: await contactCode(id, data.contactType) })
      .where(eq(contacts.id, id));

    // A login is only created when the feature is switched on.
    if (setting.contactLogin && data.email && data.password) {
      const [userRow] = await tx.insert(users).values({
        name: data.name,
        avatar: data.avatar ?? '',
        email: data.email,
        isActive: 1,
        password: await hashPassword(data.password),
        roleId:
          data.contactType === ContactType.Supplier ? SUPPLIER_ROLE_ID : CUSTOMER_ROLE_ID,
        contactId: String(id),
        notificationPreference: 'mail',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx
        .update(contacts)
        .set({ userId: String(Number(userRow.insertId)) })
        .where(eq(contacts.id, id));
    }

    // The contact's own ledger account.
    const isSupplier = data.contactType === ContactType.Supplier;
    const parentId = isSupplier ? SUPPLIER_PARENT_ACCOUNT_ID : CUSTOMER_PARENT_ACCOUNT_ID;
    const accountType = isSupplier ? AccountType.Liability : AccountType.Asset;

    const [accountRow] = await tx.insert(chartAccounts).values({
      level: 2,
      isGroup: 0,
      name: data.name,
      description: null,
      configurationGroupId: null,
      status: 1,
      parentId,
      type: String(accountType),
      contactableType: MorphType.ContactModel,
      contactableId: id,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const accountId = Number(accountRow.insertId);

    // `'0' . type . '-' . sprintf('%02d', parent_id) . '-' . id`
    await tx
      .update(chartAccounts)
      .set({
        code: `0${accountType}-${String(parentId).padStart(2, '0')}-${accountId}`,
      })
      .where(eq(chartAccounts.id, accountId));

    // Opening balance, offset against the seeded control account.
    const opening = Number(data.openingBalance ?? 0);
    if (opening > 0) {
      const controlId = await openingBalanceControlAccountId(tx);

      if (isSupplier) {
        await createOpeningBalanceForContact(
          {
            liabilityAccountId: accountId,
            liabilityAmount: opening,
            date: today(),
          },
          tx,
        );
        if (controlId) {
          await createOpeningBalanceForContact(
            {
              liabilityAccountId: controlId,
              liabilityAmount: -opening,
              date: today(),
            },
            tx,
          );
        }
      } else {
        await createOpeningBalanceForContact(
          {
            assetAccountId: accountId,
            assetAmount: opening,
            liabilityAccountId: controlId,
            liabilityAmount: opening,
            date: today(),
          },
          tx,
        );
      }

      await createOpeningBalanceHistory(
        {
          accountId,
          type: data.contactType.toLowerCase(),
          amount: opening,
        },
        tx,
      );
    }

    void period;
    return id;
  });

  return contactId;
}

/** `ContactRepository::update($data, $id)` */
export async function updateContact(
  id: number,
  data: ContactInput,
  userId?: number | null,
): Promise<void> {
  const setting = await generalSetting();

  const [existing] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!existing) return;

  // A replacement avatar removes the old file, as the PHP did.
  if (data.avatar && existing.avatar) {
    await deleteStoredFile(existing.avatar);
  }

  await runInTransaction(async (tx) => {
    const updates: Record<string, unknown> = {
      contactType: data.contactType,
      name: data.name,
      businessName: data.businessName ?? null,
      taxNumber: data.taxNumber ?? null,
      openingBalance: data.openingBalance ?? existing.openingBalance,
      payTerm: data.payTerm ?? null,
      payTermCondition: data.payTermCondition ?? '',
      customerGroup: data.customerGroup ?? null,
      creditLimit: data.creditLimit ?? null,
      email: data.email ?? null,
      username: data.username ?? null,
      mobile: data.mobile ?? null,
      alternateContactNo: data.alternateContactNo ?? null,
      countryId: data.countryId ?? null,
      state: data.state ?? null,
      city: data.city ?? null,
      note: data.note ?? null,
      address: data.address ?? null,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    };
    if (data.avatar) updates.avatar = data.avatar;

    await tx.update(contacts).set(updates).where(eq(contacts.id, id));

    if (setting.contactLogin && data.email) {
      const linkedUserId = existing.userId ? Number(existing.userId) : null;
      const [linked] = linkedUserId
        ? await tx.select().from(users).where(eq(users.id, linkedUserId)).limit(1)
        : [];

      const userValues: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        photo: data.avatar ?? '',
        avatar: data.avatar ?? '',
        roleId:
          data.contactType === ContactType.Supplier ? SUPPLIER_ROLE_ID : CUSTOMER_ROLE_ID,
        contactId: String(id),
        updatedAt: new Date(),
      };
      if (data.password) userValues.password = await hashPassword(data.password);

      if (linked) {
        await tx.update(users).set(userValues).where(eq(users.id, linked.id));
      } else {
        const [row] = await tx.insert(users).values({
          ...(userValues as { name: string; email: string }),
          password: data.password
            ? await hashPassword(data.password)
            : await hashPassword(crypto.randomUUID()),
          isActive: 1,
          notificationPreference: 'mail',
          createdAt: new Date(),
        } as never);
        await tx
          .update(contacts)
          .set({ userId: String(Number(row.insertId)) })
          .where(eq(contacts.id, id));
      }
    }

    // Keep the ledger account's name in step with the contact's.
    await tx
      .update(chartAccounts)
      .set({ name: data.name, updatedBy: userId ?? null, updatedAt: new Date() })
      .where(
        sql`${chartAccounts.contactableType} = ${MorphType.ContactModel}
            and ${chartAccounts.contactableId} = ${id}`,
      );
  });
}

/**
 * `ContactRepository::delete($id)` - refuses when the contact has documents,
 * returning the same message the PHP flashed.
 */
export async function deleteContact(
  id: number,
): Promise<{ ok: boolean; message?: string }> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!contact) return { ok: false, message: 'Contact not found' };

  if (contact.contactType === ContactType.Customer) {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .where(eq(sales.customerId, id));
    if (Number(row?.count ?? 0) > 0) {
      return { ok: false, message: 'Contact has Invoice' };
    }
  } else {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, id));
    if (Number(row?.count ?? 0) > 0) {
      return { ok: false, message: 'Supplier has Purchase' };
    }
  }

  await db.delete(contacts).where(eq(contacts.id, id));
  await deleteStoredFile(contact.avatar);
  return { ok: true, message: 'Contact Deleted Successfully' };
}

/** `statusChange(['id', 'status'])` */
export async function setContactActive(id: number, isActive: number): Promise<void> {
  await db
    .update(contacts)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(contacts.id, id));
}

/** `customerSaleHistory($id)` */
/** The `users` row a contact is linked to, if `contact_login` ever made one. */
export async function contactUserId(id: number): Promise<number | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await db
    .select({ userId: contacts.userId })
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  const userId = row?.userId ? Number(row.userId) : null;
  return Number.isSafeInteger(userId) && userId ? userId : null;
}

/** `unique:users,email,<ignoreUserId>` */
export async function emailTaken(
  email: string,
  ignoreUserId: number | null,
): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return rows.some((row) => row.id !== ignoreUserId);
}

export async function customerSaleHistory(contactId: number) {
  return db
    .select()
    .from(sales)
    .where(eq(sales.customerId, contactId))
    .orderBy(sql`${sales.id} desc`);
}

/** `supplierPurchaseHistory($id)` */
export async function supplierPurchaseHistory(contactId: number) {
  return db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, contactId))
    .orderBy(sql`${purchaseOrders.id} desc`);
}
