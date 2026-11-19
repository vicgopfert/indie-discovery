import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = { title: 'Redefinir senha', robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Redefinir senha</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <p>
          O link venceu ou já foi usado?{' '}
          <Link href="/esqueci-senha" className="underline">
            Pedir um novo link
          </Link>
        </p>
        <p>
          <Link href="/entrar" className="underline">
            Voltar para o login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
