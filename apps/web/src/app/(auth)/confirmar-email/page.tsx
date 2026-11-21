import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmEmailView } from '@/features/auth/confirm-email-view';

export const metadata: Metadata = { title: 'Confirmar e-mail', robots: { index: false } };

export default function ConfirmEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Confirmar e-mail</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ConfirmEmailView />
      </CardContent>
    </Card>
  );
}
