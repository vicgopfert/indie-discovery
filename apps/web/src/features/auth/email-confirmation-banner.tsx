'use client';

import { LATEST_LINK_NOTE } from '@indie/contracts';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-client';
import { useRequestEmailConfirmation, useSession } from './hooks';
import { useClearAccountWhenUnauthorized } from './session-gate';

export const CONFIRM_EMAIL_PATH = '/confirmar-email';

export const CONFIRMATION_SENT_MESSAGE = `Enviamos um novo link. ${LATEST_LINK_NOTE}`;

// Em todas as páginas, para quem entrou e não confirmou, menos na própria confirmação.
export function EmailConfirmationBanner() {
  const pathname = usePathname();
  const { data: user } = useSession();
  if (!user || user.emailConfirmedAt || pathname === CONFIRM_EMAIL_PATH) return null;
  return <ConfirmationReminder email={user.email} />;
}

function ConfirmationReminder({ email }: { email: string }) {
  const resend = useRequestEmailConfirmation();
  useClearAccountWhenUnauthorized(resend.error);

  return (
    <section aria-label="Confirmação do e-mail" className="border-b bg-muted">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <p>
          Confirme o seu e-mail, <strong className="break-all">{email}</strong>, pelo link de
          confirmação.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
        >
          {resend.isPending ? 'Enviando…' : 'Reenviar e-mail'}
        </Button>
        <p aria-live="polite" className={resend.isError ? 'text-destructive' : undefined}>
          {resend.isSuccess && CONFIRMATION_SENT_MESSAGE}
          {resend.isError && errorMessage(resend.error)}
        </p>
      </div>
    </section>
  );
}
