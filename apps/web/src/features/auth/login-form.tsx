'use client';

import { LoginSchema } from '@indie/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/form/form-alert';
import { PasswordField } from '@/components/form/password-field';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { showApiError } from '@/lib/form-errors';
import { useLogin } from './hooks';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const login = useLogin();
  const form = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      await login.mutateAsync(input);
      router.replace(redirectTo);
    } catch (error) {
      showApiError(error, form.setError, { fields: ['email', 'password'] });
    }
  });

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
        />
        <PasswordField
          control={form.control}
          name="password"
          label="Senha"
          autoComplete="current-password"
        />
        <p className="-mt-3 text-sm">
          <Link href="/esqueci-senha" className="underline">
            Esqueci minha senha
          </Link>
        </p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </FieldGroup>
    </form>
  );
}
