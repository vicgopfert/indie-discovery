'use client';

import { type ComponentProps, useId } from 'react';
import { type Control, type FieldValues, type Path, useController } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type TextFieldProps<TValues extends FieldValues, TTransformed> = Omit<
  ComponentProps<typeof Input>,
  'id' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur'
> & {
  control: Control<TValues, unknown, TTransformed>;
  name: Path<TValues>;
  label: string;
  description?: string;
};

export function TextField<TValues extends FieldValues, TTransformed>({
  control,
  name,
  label,
  description,
  ...inputProps
}: TextFieldProps<TValues, TTransformed>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [description && descriptionId, fieldState.error && errorId]
    .filter(Boolean)
    .join(' ');

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        {...inputProps}
        {...field}
        id={id}
        aria-invalid={fieldState.invalid}
        aria-describedby={describedBy || undefined}
      />
      {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      <FieldError id={errorId} errors={[fieldState.error]} />
    </Field>
  );
}
