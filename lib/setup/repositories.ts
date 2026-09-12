// ---------------------------------------------------------------------------
// Setup + Location module repositories.
//
// Ports Modules/Inventory (ShowRoom, WareHouse), Modules/Setup (Tax,
// IntroPrefix, Department, Country) and Modules/Setting (Currency).
//
// Creating a branch also creates its cash ledger account, which is how
// `totalCash()` and the branch-scoped reports find their balances.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  chartAccounts,
  countries,
  currencies,
  introPrefix,
  purchaseOrders,
  sales,
  showRooms,
  stockReports,
  wareHouses,
  type CountriesRow,
  type CurrenciesRow,
  type IntroPrefixRow,
  type ShowRoomsRow,
  type WareHousesRow,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { createReferenceRepository } from '@/lib/crud/reference-entity';
import { AccountType, ConfigurationGroup, RootAccountId } from '@/lib/accounting/accounts';

export const showRoomRepository = createReferenceRepository<ShowRoomsRow>({
  table: showRooms,
  id: showRooms.id,
  searchable: [showRooms.name, showRooms.email, showRooms.phone, showRooms.address],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const wareHouseRepository = createReferenceRepository<WareHousesRow>({
  table: wareHouses,
  id: wareHouses.id,
  searchable: [wareHouses.name, wareHouses.email, wareHouses.phone, wareHouses.address],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const introPrefixRepository = createReferenceRepository<IntroPrefixRow>({
  table: introPrefix,
  id: introPrefix.id,
  searchable: [introPrefix.prefix, introPrefix.title],
  audit: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

export const currencyRepository = createReferenceRepository<CurrenciesRow>({
  table: currencies,
  id: currencies.id,
  searchable: [currencies.name, currencies.code, currencies.symbol],
  audit: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

export const countryRepository = createReferenceRepository<CountriesRow>({
  table: countries,
  id: countries.id,
  searchable: [countries.name, countries.iso2, countries.iso3, countries.currency],
  audit: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

/** Active branches, for the header selector and every branch picker. */
export async function activeShowRooms() {
  return db
    .select()
    .from(showRooms)
    .where(eq(showRooms.status, 1))
    .orderBy(asc(showRooms.name));
}

export async function activeWareHouses() {
  return db
    .select()
    .from(wareHouses)
    .where(eq(wareHouses.status, 1))
    .orderBy(asc(wareHouses.name));
}

/**
 * A branch owns a cash account under the Cash root, linked polymorphically.
 * `ShowRoomController@store` created it alongside the branch.
 */
export async function createShowRoomWithAccount(
  data: {
    name: string;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
    status: number;
  },
  userId?: number | null,
): Promise<number> {
  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(showRooms).values({
      name: data.name,
      email: data.email ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      status: data.status,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const showroomId = Number(inserted.insertId);

    const [accountRow] = await tx.insert(chartAccounts).values({
      level: 2,
      isGroup: 0,
      name: data.name,
      type: String(AccountType.Asset),
      configurationGroupId: ConfigurationGroup.Cash,
      status: 1,
      parentId: RootAccountId.Cash,
      contactableType: MorphType.ShowRoom,
      contactableId: showroomId,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const accountId = Number(accountRow.insertId);
    await tx
      .update(chartAccounts)
      .set({
        code: `0${AccountType.Asset}-${String(RootAccountId.Cash).padStart(2, '0')}-${accountId}`,
      })
      .where(eq(chartAccounts.id, accountId));

    return showroomId;
  });
}

/** Keep the branch's ledger account name in step. */
export async function updateShowRoom(
  id: number,
  data: {
    name: string;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
    status: number;
  },
  userId?: number | null,
): Promise<void> {
  await runInTransaction(async (tx) => {
    await tx
      .update(showRooms)
      .set({
        name: data.name,
        email: data.email ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        status: data.status,
        updatedBy: userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(showRooms.id, id));

    await tx
      .update(chartAccounts)
      .set({ name: data.name, updatedBy: userId ?? null, updatedAt: new Date() })
      .where(
        and(
          eq(chartAccounts.contactableType, MorphType.ShowRoom),
          eq(chartAccounts.contactableId, id),
        ),
      );
  });
}

/** A branch holding stock or documents must not be removed. */
export async function showRoomInUse(id: number): Promise<string | null> {
  const [stockRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockReports)
    .where(
      and(
        eq(stockReports.houseableId, id),
        eq(stockReports.houseableType, MorphType.ShowRoom),
      ),
    );
  if (Number(stockRow?.count ?? 0) > 0) return 'Branch still holds stock';

  const [saleRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sales)
    .where(and(eq(sales.saleableId, id), eq(sales.saleableType, MorphType.ShowRoom)));
  if (Number(saleRow?.count ?? 0) > 0) return 'Branch has sales';

  const [purchaseRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.purchasableId, id),
        eq(purchaseOrders.purchasableType, MorphType.ShowRoom),
      ),
    );
  if (Number(purchaseRow?.count ?? 0) > 0) return 'Branch has purchases';

  return null;
}

export async function wareHouseInUse(id: number): Promise<string | null> {
  const [stockRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockReports)
    .where(
      and(
        eq(stockReports.houseableId, id),
        eq(stockReports.houseableType, MorphType.WareHouse),
      ),
    );
  if (Number(stockRow?.count ?? 0) > 0) return 'Warehouse still holds stock';
  return null;
}

/** Both location kinds as one option list, keyed `showroom-1` / `warehouse-3`. */
export async function locationOptions() {
  const [branches, houses] = await Promise.all([activeShowRooms(), activeWareHouses()]);
  return [
    ...branches.map((b) => ({ value: `showroom-${b.id}`, label: `${b.name} (Branch)` })),
    ...houses.map((w) => ({ value: `warehouse-${w.id}`, label: `${w.name} (Warehouse)` })),
  ];
}
