'use client';

import { PasswordResetRequestSchema } from '@indie/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/form/form-alert';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { showApiError } from '@/lib/form-errors';
import { useRequestPasswordReset } from './hooks';

// A mesma mensagem para qualquer e-mail: a página não diz se a conta existe.
export const RESET_REQUESTED_MESSAGE =
  'Se houver uma conta com este e-mail, você vai receber um link para redefinir a senha. ' +
  'O link vale por 60 minutos. Se não chegar, confira a caixa de spam.';

export function ForgotPasswordForm() {
  const requestReset = useRequestPasswordReset();
  const form = useForm({
    resolver: zodResolver(PasswordResetRequestSchema),
    defaultValues: { email: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      await requestReset.mutateAsync(input);
    } catch (error) {
      showApiError(error, form.setError, { fields: ['email'] });
    }
  });

  if (requestReset.isSuccess) return <p role="status">{RESET_REQUESTED_MESSAGE}</p>;

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate>
      <FieldGroup>
        <FormAlert message={errors.root?.server?.message} />
        <TextField
          control={form.control}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          description="Enviaremos um link para escolher uma senha nova."
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando…' : 'Enviar link'}
        </Button>
      </FieldGroup>
    </form>
  );
}
