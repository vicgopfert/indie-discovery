'use client';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, RegisterSchema } from '@indie/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/form/form-alert';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { showApiError } from '@/lib/form-errors';
import { useRegister } from './hooks';

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const register = useRegister();
  const form = useForm({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      await register.mutateAsync(input);
      router.replace(redirectTo);
    } catch (error) {
      showApiError(error, form.setError, {
        fields: ['displayName', 'email', 'password'],
        fieldByStatus: { 409: 'email' },
      });
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate>
      <FieldGroup>
        <FormAlert message={errors.root?.server?.message} />
        <TextField
          control={form.control}
          name="displayName"
          label="Nome de exibição"
          autoComplete="nickname"
        />
        <TextField
          control={form.control}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
        />
        <TextField
          control={form.control}
          name="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          description={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </FieldGroup>
    </form>
  );
}
