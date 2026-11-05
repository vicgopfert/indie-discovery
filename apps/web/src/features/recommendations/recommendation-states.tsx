'use client';

import type { DiscoveryMode, RecommendationOverview, User } from '@indie/contracts';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { clearAccount, useSession } from '@/features/auth/hooks';
import { CATALOG_PATH } from '@/features/catalog/search-params';
import { errorMessage, isUnauthorized } from '@/lib/api-client';
import { withRedirect } from '@/lib/safe-redirect';
import { useSaveDiscoveryMode } from './hooks';
import { ModeSelector } from './mode-selector';

type Basis = RecommendationOverview['basis'];

// Quem não entrou vê o convite, com volta para a página pedida. O título vai junto quando a
// página não tem um fixo.
export function SessionGate({
  next,
  heading,
  children,
}: {
  next: string;
  heading?: ReactNode;
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
          para ver suas recomendações.
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

export function RecommendationsLoading() {
  return <p className="text-sm text-muted-foreground">Carregando suas recomendações…</p>;
}

export function RecommendationsError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar as recomendações</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
          Tentar de novo
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// Com a lista vazia ou de populares, o modo não muda nada, e trocá-lo pareceria quebrado.
export function ModeControls({
  mode,
  basis,
  updating,
  onSaved,
}: {
  mode: DiscoveryMode;
  basis: Basis;
  updating: boolean;
  onSaved?: () => void;
}) {
  const saveMode = useSaveDiscoveryMode();
  return (
    <>
      {basis === 'profile' && (
        <ModeSelector
          mode={mode}
          saving={saveMode.isPending}
          onSelect={(next) => saveMode.mutate(next, { onSuccess: () => onSaved?.() })}
        />
      )}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saveMode.isPending ? 'Salvando…' : updating ? 'Atualizando…' : ''}
      </p>
      {saveMode.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(saveMode.error)}
        </p>
      )}
    </>
  );
}

export function EmptyProfile() {
  return (
    <p>
      Avalie alguns jogos ou guarde nas suas listas para receber recomendações.{' '}
      <Link href={CATALOG_PATH} className="underline">
        Ver o catálogo
      </Link>
    </p>
  );
}

// A frase do "Pouco conhecido" explica o selo dos cartões, então só vai onde há cartões.
export function BasisNote({
  basis,
  mode,
  withBadges,
}: {
  basis: Basis;
  mode: DiscoveryMode;
  withBadges: boolean;
}) {
  if (basis === 'popular') {
    return (
      <p>
        Suas notas ainda não mostram do que você gosta; estes são jogos populares. Dê 4 ou 5 aos que
        você curtir.
      </p>
    );
  }
  if (withBadges && basis === 'profile' && mode === 'DISCOVERY') {
    return (
      <p className="text-sm">Pouco conhecido: o jogo entrou na lista por ser menos popular.</p>
    );
  }
  return null;
}
