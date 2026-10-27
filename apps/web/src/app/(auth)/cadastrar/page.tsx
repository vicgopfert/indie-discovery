import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GuestOnly } from '@/features/auth/guest-only';
import { RegisterForm } from '@/features/auth/register-form';
import { safeRedirect, withRedirect } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Criar conta' };

export default async function RegisterPage({ searchParams }: PageProps<'/cadastrar'>) {
  const redirectTo = safeRedirect((await searchParams).next);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Criar conta</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <GuestOnly>
          <RegisterForm redirectTo={redirectTo} />
        </GuestOnly>
      </CardContent>
      <CardFooter className="text-sm">
        <p>
          Já tem conta?{' '}
          <Link href={withRedirect('/entrar', redirectTo)} className="underline">
            Entrar
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
