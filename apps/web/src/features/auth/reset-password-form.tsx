'use client';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordResetConfirmSchema,
} from '@indie/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/form/form-alert';
import { PasswordField } from '@/components/form/password-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { showApiError } from '@/lib/form-errors';
import { useResetPassword } from './hooks';
import { useInBrowser, useTokenFromLink } from './link-token';

export const PASSWORD_RESET_DONE_PATH = '/entrar?senha=redefinida';

// A página aberta sem token, como ao recarregá-la: o link do e-mail pode ainda valer.
export const MISSING_RESET_TOKEN_MESSAGE =
  'Abra de novo o link que enviamos por e-mail. Se ele venceu, peça um novo.';

const NewPasswordFormSchema = PasswordResetConfirmSchema.pick({ password: true });

export function ResetPasswordForm() {
  return useInBrowser() ? <ResetPasswordFormWithLink /> : null;
}

function ResetPasswordFormWithLink() {
  const token = useTokenFromLink();
  const router = useRouter();
  const resetPassword = useResetPassword();
  const form = useForm({
    resolver: zodResolver(NewPasswordFormSchema),
    defaultValues: { password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  if (!token) return <FormAlert message={MISSING_RESET_TOKEN_MESSAGE} />;

  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await resetPassword.mutateAsync({ token, password });
      router.replace(PASSWORD_RESET_DONE_PATH);
    } catch (error) {
      showApiError(error, form.setError, { fields: ['password'] });
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate>
      <FieldGroup>
        <FormAlert message={errors.root?.server?.message} />
        <PasswordField
          control={form.control}
          name="password"
          label="Nova senha"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          description={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres. Ao salvar, todas as sessões abertas são encerradas.`}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </FieldGroup>
    </form>
  );
}
