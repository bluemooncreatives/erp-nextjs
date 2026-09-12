import 'server-only';

/**
 * Normalise the arguments of a `useActionState` server action.
 *
 * React calls these actions as `(previousState, formData)` once the page is
 * interactive, but Next's progressive-enhancement path - a plain form POST,
 * before hydration or with JavaScript disabled - calls them with the FormData
 * alone. Without this, the first argument is the FormData and the second is
 * undefined, and the action throws.
 *
 * The Blade forms worked without JavaScript, so the ported forms do too.
 */
export function actionFormData(previous: unknown, formData?: FormData): FormData {
  if (formData instanceof FormData) return formData;
  if (previous instanceof FormData) return previous;
  // Neither argument carried a form: hand back an empty one so the action's own
  // validation reports missing fields instead of throwing.
  return new FormData();
}
