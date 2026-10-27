import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GuestOnly } from '@/features/auth/guest-only';
import { LoginForm } from '@/features/auth/login-form';
import { type AuthPageProps, safeRedirect, withRedirect } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: AuthPageProps) {
  const redirectTo = safeRedirect((await searchParams).next);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Entrar</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <GuestOnly>
          <LoginForm redirectTo={redirectTo} />
        </GuestOnly>
      </CardContent>
      <CardFooter className="text-sm">
        <p>
          Ainda não tem conta?{' '}
          <Link href={withRedirect('/cadastrar', redirectTo)} className="underline">
            Criar conta
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
