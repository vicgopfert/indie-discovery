'use client';

import type { DiscoveryMode, RecommendationOverview } from '@indie/contracts';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ONBOARDING_PATH } from '@/features/onboarding/paths';
import { errorMessage } from '@/lib/api-client';
import { useSaveDiscoveryMode } from './hooks';
import { ModeSelector } from './mode-selector';

type Basis = RecommendationOverview['basis'];

export const RECOMMENDATIONS_INVITE = 'para ver suas recomendações.';

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
      Conte do que você gosta para receber recomendações.{' '}
      <Link href={ONBOARDING_PATH} className="underline">
        Escolher meus gostos
      </Link>
    </p>
  );
}

export function ChangeTastesLink() {
  return (
    <p className="text-sm">
      <Link href={ONBOARDING_PATH} className="underline">
        Mudar meus gostos
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
