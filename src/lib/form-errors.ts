import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/errors'
import { errorMessage } from '@/components/states'

/**
 * Maps API field errors onto the form and returns a message for anything
 * that couldn't be attached to a field (shown in a FormAlert).
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): string | null {
  if (!isApiError(error)) return errorMessage(error)
  let attached = false
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !attached })
      attached = true
    }
  }
  return attached && error.code === 'VALIDATION_ERROR' ? null : error.message
}

/** Only same-origin paths are accepted as post-login destinations. */
export function safeRedirect(target: string | undefined, fallback = '/') {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return fallback
  return target
}
