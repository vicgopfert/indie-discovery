'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { FormAlert } from '@/components/form/form-alert';
import { errorMessage } from '@/lib/api-client';
import { useConfirmEmail } from './hooks';
import { useInBrowser, useTokenFromLink } from './link-token';

// A página aberta sem token, como ao recarregá-la: o link do e-mail pode ainda valer.
export const MISSING_CONFIRMATION_TOKEN_MESSAGE =
  'Abra de novo o link que enviamos por e-mail. Se ele venceu, entre na sua conta e peça um novo.';

export function ConfirmEmailView() {
  return useInBrowser() ? <ConfirmEmailWithLink /> : null;
}

// Confirma ao abrir, sem botão. O token já enviado não vai de novo, nem quando o efeito roda duas
// vezes no desenvolvimento.
function ConfirmEmailWithLink() {
  const token = useTokenFromLink();
  const confirmEmail = useConfirmEmail();
  const { mutate } = confirmEmail;
  const sentToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || sentToken.current === token) return;
    sentToken.current = token;
    mutate({ token });
  }, [token, mutate]);

  if (!token) return <FormAlert message={MISSING_CONFIRMATION_TOKEN_MESSAGE} />;
  if (confirmEmail.isError) return <FormAlert message={errorMessage(confirmEmail.error)} />;
  if (!confirmEmail.isSuccess) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Confirmando o seu e-mail…
      </p>
    );
  }

  return (
    <div role="status" className="space-y-3 text-sm">
      <p>E-mail confirmado. A partir de agora, você pode receber a redefinição de senha.</p>
      <p>
        Esqueceu a senha?{' '}
        <Link href="/esqueci-senha" className="underline">
          Pedir a redefinição
        </Link>
      </p>
      <p>
        <Link href="/" className="underline">
          Ir para o início
        </Link>
      </p>
    </div>
  );
}
