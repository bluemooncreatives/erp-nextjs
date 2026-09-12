'use server';

// Event and to-do actions - port of Modules/Attendance EventController and
// ToDoController.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  createToDo,
  completeToDo,
  deleteToDo,
} from '@/lib/hr/events';
import { sendNotification } from '@/lib/notifications';
import { MorphType } from '@/lib/db/morph';
import { saveImage, fileFrom } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type EventFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function validate(formData: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!str(formData, 'title')) errors.title = 'The title field is required.';
  if (!str(formData, 'from_date')) errors.from_date = 'The from date field is required.';
  return errors;
}

/** `EventController@store` */
export async function storeEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();

  const fieldErrors = validate(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const image = await saveImage(fileFrom(formData, 'image'));

    const eventId = await createEvent(
      {
        title: str(formData, 'title'),
        forWhom: str(formData, 'for_whom') || 'all',
        location: str(formData, 'location'),
        description: str(formData, 'description') || null,
        fromDate: str(formData, 'from_date'),
        toDate: str(formData, 'to_date') || null,
        image,
      },
      user.id,
    );

    // `sendNotification($event, null, $title, null, null, $description, null, $role_id, $url)`
    await sendNotification({
      notifiableType: MorphType.Event,
      notifiableId: eventId,
      subject: str(formData, 'title'),
      message: str(formData, 'description') || 'A Event Has been Created',
      role: str(formData, 'for_whom') || null,
      url: ROUTES['events.index'],
    });

    await successLog('Event Has Been Created Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['events.index']);
  return { success: 'Event Has Been Created Successfully' };
}

/** `EventController@update` */
export async function saveEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();
  const id = Number(formData.get('id'));

  const fieldErrors = validate(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const image = await saveImage(fileFrom(formData, 'image'));

    await updateEvent(
      id,
      {
        title: str(formData, 'title'),
        forWhom: str(formData, 'for_whom') || 'all',
        location: str(formData, 'location'),
        description: str(formData, 'description') || null,
        fromDate: str(formData, 'from_date'),
        toDate: str(formData, 'to_date') || null,
        image,
      },
      user.id,
    );
    await successLog('Event Has Been Updated Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  redirect(ROUTES['events.index']);
}

/** `EventController@destroy` */
export async function destroyEvent(formData: FormData): Promise<void> {
  const user = await requireUser();
  await deleteEvent(Number(formData.get('id')));
  await successLog('Event Has Been Deleted Successfully', user.id);
  revalidatePath(ROUTES['events.index']);
}

/** `ToDoController@store` */
export async function storeToDo(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();

  const fieldErrors: Record<string, string> = {};
  if (!str(formData, 'title')) fieldErrors.title = 'The title field is required.';
  if (!str(formData, 'date')) fieldErrors.date = 'The date field is required.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createToDo({ title: str(formData, 'title'), date: str(formData, 'date') }, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['to_dos.index']);
  revalidatePath(ROUTES['events.index']);
  return { success: 'To Do Created Successfully' };
}

/** `ToDoController@completeToDo` */
export async function markToDoComplete(formData: FormData): Promise<void> {
  const user = await requireUser();
  await completeToDo(Number(formData.get('id')), user.id);
  revalidatePath(ROUTES['to_dos.index']);
  revalidatePath(ROUTES['events.index']);
}

export async function destroyToDo(formData: FormData): Promise<void> {
  await requireUser();
  await deleteToDo(Number(formData.get('id')));
  revalidatePath(ROUTES['to_dos.index']);
  revalidatePath(ROUTES['events.index']);
}
