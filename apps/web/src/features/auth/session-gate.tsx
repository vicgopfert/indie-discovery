'use client';

import type { User } from '@indie/contracts';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect } from 'react';
import { isUnauthorized } from '@/lib/api-client';
import { withRedirect } from '@/lib/safe-redirect';
import { clearAccount, useSession } from './hooks';

// Quem não entrou vê o convite, com volta para a página pedida. O título vai junto quando a
// página não tem um fixo.
export function SessionGate({
  next,
  heading,
  invite,
  children,
}: {
  next: string;
  heading?: ReactNode;
  invite: string;
  children: (user: User) => ReactNode;
}) {
  const { data: user, isPending } = useSession();

  // Reserva o espaço enquanto a sessão carrega, para não mostrar o convite a quem já entrou.
  if (isPending) return <div aria-hidden="true" className="h-24" />;

  if (!user) {
    return (
      <>
        {heading}
        <p>
          <Link href={withRedirect('/entrar', next)} className="underline">
            Entre
          </Link>{' '}
          {invite}
        </p>
      </>
    );
  }

  return children(user);
}

// A sessão venceu: a página volta ao convite para entrar.
export function useClearAccountWhenUnauthorized(error: unknown) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isUnauthorized(error)) clearAccount(queryClient);
  }, [error, queryClient]);
}
