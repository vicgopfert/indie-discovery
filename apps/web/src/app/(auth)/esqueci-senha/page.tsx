import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { GuestOnly } from '@/features/auth/guest-only';

export const metadata: Metadata = { title: 'Esqueci minha senha', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Esqueci minha senha</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <GuestOnly>
          <ForgotPasswordForm />
        </GuestOnly>
      </CardContent>
      <CardFooter className="text-sm">
        <p>
          Lembrou a senha?{' '}
          <Link href="/entrar" className="underline">
            Entrar
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
