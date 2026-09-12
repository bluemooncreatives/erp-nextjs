// ---------------------------------------------------------------------------
// Reference-data CRUD.
//
// Brand, Category, Model, Unit Type, Variant, Tax, Department, Warehouse,
// Branch and several Setup tables all had the same repository in the PHP stack:
//
//   all()        -> latest()->get()
//   serachBased()-> whereLike(['name','description'], $keyword)
//   create()     -> fill + save        (created_by from the model boot hook)
//   find()       -> findOrFail
//   update()     -> findOrFail + update (updated_by from the boot hook)
//   delete()     -> findOrFail + delete
//
// This builds one typed repository per table instead of repeating it, keeping
// the same behaviour including the `created_by` / `updated_by` stamping.
// ---------------------------------------------------------------------------

import 'server-only';
import {
  and,
  desc,
  eq,
  like,
  or,
  sql,
  type SQL,
  type Column,
} from 'drizzle-orm';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '@/lib/db/client';

export type ReferenceEntityConfig = {
  /** The Drizzle table. */
  table: MySqlTable;
  /** Primary key column. */
  id: Column;
  /** Columns searched by the `search_index` routes. */
  searchable: Column[];
  /**
   * TypeScript property names of the audit columns, when the table has them.
   * Property names (not database column names) because that is what Drizzle's
   * `values()` / `set()` are keyed by.
   */
  audit?: {
    createdBy?: string;
    updatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type ListOptions = {
  search?: string;
  page?: number;
  perPage?: number;
  /** Extra predicate, e.g. restricting a category tree to one level. */
  where?: SQL;
};

export type ListResult<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
};

export function createReferenceRepository<T extends Record<string, unknown>>(
  config: ReferenceEntityConfig,
) {
  const { table, id, searchable } = config;
  const audit = config.audit ?? {};

  function searchCondition(search?: string): SQL | undefined {
    if (!search || !searchable.length) return undefined;
    const term = `%${search}%`;
    const parts = searchable.map((col) => like(col, term));
    return parts.length === 1 ? parts[0] : or(...parts);
  }

  function combine(options: ListOptions): SQL | undefined {
    const parts = [searchCondition(options.search), options.where].filter(
      (p): p is SQL => p != null,
    );
    if (!parts.length) return undefined;
    return parts.length === 1 ? parts[0] : and(...parts);
  }

  return {
    /** `all()` with the search + pagination the list screens use. */
    async list(options: ListOptions = {}): Promise<ListResult<T>> {
      const page = Math.max(1, options.page ?? 1);
      const perPage = options.perPage ?? 25;
      const where = combine(options);

      const rows = (await db
        .select()
        .from(table)
        .where(where)
        .orderBy(desc(id))
        .limit(perPage)
        .offset((page - 1) * perPage)) as T[];

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(where);

      return { rows, total: Number(countRow?.count ?? 0), page, perPage };
    },

    /** Every row, for dropdowns. */
    async all(where?: SQL): Promise<T[]> {
      return (await db.select().from(table).where(where).orderBy(desc(id))) as T[];
    },

    /** `findOrFail($id)` - returns null instead of throwing. */
    async find(value: number): Promise<T | null> {
      const [row] = await db.select().from(table).where(eq(id, value)).limit(1);
      return (row as T) ?? null;
    },

    /** `create($data)` - stamps `created_by` the way the model boot hook did. */
    async create(
      values: Record<string, unknown>,
      userId?: number | null,
    ): Promise<number> {
      const payload: Record<string, unknown> = { ...values };
      if (audit.createdBy && userId != null) payload[audit.createdBy] = userId;
      if (audit.createdAt) payload[audit.createdAt] = new Date();
      if (audit.updatedAt) payload[audit.updatedAt] = new Date();

      const [result] = await db.insert(table).values(payload);
      return Number(result.insertId);
    },

    /** `update($data, $id)` - stamps `updated_by`. */
    async update(
      value: number,
      values: Record<string, unknown>,
      userId?: number | null,
    ): Promise<void> {
      const payload: Record<string, unknown> = { ...values };
      if (audit.updatedBy && userId != null) payload[audit.updatedBy] = userId;
      if (audit.updatedAt) payload[audit.updatedAt] = new Date();

      await db.update(table).set(payload).where(eq(id, value));
    },

    /** `delete($id)` */
    async remove(value: number): Promise<void> {
      await db.delete(table).where(eq(id, value));
    },

    /** Used by the "is this still referenced?" guards before deleting. */
    async exists(value: number): Promise<boolean> {
      const [row] = await db
        .select({ count: sql<number>`1` })
        .from(table)
        .where(eq(id, value))
        .limit(1);
      return Boolean(row);
    },
  };
}
