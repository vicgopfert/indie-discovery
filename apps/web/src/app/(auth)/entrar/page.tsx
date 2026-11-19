import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GuestOnly } from '@/features/auth/guest-only';
import { LoginForm } from '@/features/auth/login-form';
import { type AuthPageProps, safeRedirect, withRedirect } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Entrar' };

type LoginPageProps = {
  searchParams: Promise<Awaited<AuthPageProps['searchParams']> & { senha?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, senha } = await searchParams;
  const redirectTo = safeRedirect(next);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Entrar</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {senha === 'redefinida' && (
          <Alert role="status">
            <AlertDescription>Senha alterada. Entre com a nova senha.</AlertDescription>
          </Alert>
        )}
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
