// ---------------------------------------------------------------------------
// Events and to-dos - port of Modules/Attendance's EventRepository,
// EventController and ToDoController.
// ---------------------------------------------------------------------------

import 'server-only';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { events, roles, toDos } from '@/lib/db/schema';
import { toDateString, today } from '@/lib/php-date';

export type EventInput = {
  title: string;
  forWhom: string;
  location: string;
  description?: string | null;
  fromDate: string;
  toDate?: string | null;
  image?: string | null;
};

/** `EventRepository::all()` */
export async function listEvents() {
  return db.select().from(events).orderBy(desc(events.createdAt));
}

export async function findEvent(id: number) {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row ?? null;
}

/** `EventRepository::roleWiseEvents()` - what the dashboard calendar shows. */
export async function roleWiseEvents(roleName: string) {
  return db
    .select()
    .from(events)
    .where(or(eq(events.forWhom, 'all'), eq(events.forWhom, roleName)))
    .orderBy(desc(events.fromDate));
}

/** `EventRepository::create($data)` */
export async function createEvent(data: EventInput, actorId?: number | null) {
  const [inserted] = await db.insert(events).values({
    title: data.title,
    forWhom: data.forWhom,
    location: data.location,
    description: data.description ?? null,
    fromDate: toDateString(data.fromDate) ?? today(),
    toDate: toDateString(data.toDate) ?? null,
    image: data.image ?? null,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number(inserted.insertId);
}

/** `EventRepository::update($data, $id)` - the image is kept when none is sent. */
export async function updateEvent(
  id: number,
  data: EventInput,
  actorId?: number | null,
): Promise<void> {
  const values: Record<string, unknown> = {
    title: data.title,
    forWhom: data.forWhom,
    location: data.location,
    description: data.description ?? null,
    fromDate: toDateString(data.fromDate) ?? today(),
    toDate: toDateString(data.toDate) ?? null,
    updatedBy: actorId ?? null,
    updatedAt: new Date(),
  };
  if (data.image) values.image = data.image;

  await db.update(events).set(values).where(eq(events.id, id));
}

export async function deleteEvent(id: number): Promise<void> {
  await db.delete(events).where(eq(events.id, id));
}

/** `RoleRepository::normalRoles()` - the "for whom" picker. */
export async function normalRoles() {
  return db.select().from(roles).where(eq(roles.type, 'normal'));
}

// --- to-dos ----------------------------------------------------------------

/** Everything on the dashboard's to-do card. */
export async function listToDos() {
  return db.select().from(toDos).orderBy(desc(toDos.date));
}

/** `ToDoController@completeList()` */
export async function completedToDos() {
  return db.select().from(toDos).where(eq(toDos.status, 1)).orderBy(desc(toDos.date));
}

/** `ToDoController@store()` */
export async function createToDo(
  data: { title: string; date: string },
  actorId?: number | null,
): Promise<void> {
  await db.insert(toDos).values({
    title: data.title,
    date: toDateString(data.date) ?? today(),
    status: 0,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** `ToDoController@completeToDo()` */
export async function completeToDo(id: number, actorId?: number | null): Promise<void> {
  await db
    .update(toDos)
    .set({ status: 1, updatedBy: actorId ?? null, updatedAt: new Date() })
    .where(eq(toDos.id, id));
}

export async function deleteToDo(id: number): Promise<void> {
  await db.delete(toDos).where(eq(toDos.id, id));
}
