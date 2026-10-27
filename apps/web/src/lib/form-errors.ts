import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError, UNEXPECTED_ERROR_MESSAGE } from './api-client';

export const FORM_ERROR = 'root.server';

type Options<T extends FieldValues> = {
  fields: readonly Path<T>[];
  fieldByStatus?: Partial<Record<number, Path<T>>>;
};

// Leva o erro da API ao campo a que ele se refere; o que não tem campo aparece no topo do formulário.
export function showApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  { fields, fieldByStatus = {} }: Options<T>,
) {
  if (!(error instanceof ApiRequestError)) {
    setError(FORM_ERROR, { message: UNEXPECTED_ERROR_MESSAGE });
    return;
  }

  const statusField = fieldByStatus[error.status];
  if (statusField) {
    setError(statusField, { message: error.message });
    return;
  }

  const isField = (name: string): name is Path<T> => (fields as readonly string[]).includes(name);
  const fieldErrors = error.fieldMessages().filter(({ field }) => isField(field));
  for (const { field, message } of fieldErrors) setError(field as Path<T>, { message });
  if (fieldErrors.length < error.messages.length) setError(FORM_ERROR, { message: error.message });
}
