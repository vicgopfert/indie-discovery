'use client';

import type { FieldValues } from 'react-hook-form';
import { PasswordInput } from './password-input';
import { TextField, type TextFieldProps } from './text-field';

export function PasswordField<TValues extends FieldValues, TTransformed>(
  props: Omit<TextFieldProps<TValues, TTransformed>, 'type' | 'input'>,
) {
  return <TextField {...props} input={PasswordInput} />;
}
