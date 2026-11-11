'use client';

import type { GameLibraryState, ListType } from '@indie/contracts';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { clearAccount, useSession } from '@/features/auth/hooks';
import { errorMessage, isUnauthorized } from '@/lib/api-client';
import { withRedirect } from '@/lib/safe-redirect';
import type { LibraryAction } from './api';
import { useGameLibrary, useLibraryAction } from './hooks';
import { RatingButtons } from './rating-buttons';

const LISTS: { list: ListType; label: string }[] = [
  { list: 'FAVORITE', label: 'Favorito' },
  { list: 'COMPLETED', label: 'Concluído' },
  { list: 'WANT_TO_PLAY', label: 'Quero jogar' },
];

export function GameLibraryControls({ slug }: { slug: string }) {
  const { data: user, isPending } = useSession();

  // Reserva o espaço enquanto a sessão carrega, para não mostrar o convite a quem já entrou.
  if (isPending) return <div aria-hidden="true" className="h-24" />;

  if (!user) {
    return (
      <p className="text-sm">
        <Link
          href={withRedirect('/entrar', `/jogos/${encodeURIComponent(slug)}`)}
          className="underline"
        >
          Entre
        </Link>{' '}
        para avaliar e guardar nas suas listas.
      </p>
    );
  }

  return <LibraryState slug={slug} />;
}

function LibraryState({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const state = useGameLibrary(slug);
  const action = useLibraryAction(slug);

  // A sessão venceu: os controles voltam ao convite para entrar.
  useEffect(() => {
    if (isUnauthorized(state.error)) clearAccount(queryClient);
  }, [state.error, queryClient]);

  if (state.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando a sua nota e as suas listas…</p>;
  }
  if (state.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar a sua nota e as suas listas; recarregue a página.
      </p>
    );
  }

  return (
    <LibraryForm
      state={state.data}
      saving={action.isPending}
      saved={action.isSuccess}
      error={action.isError ? errorMessage(action.error) : null}
      onAction={(next) => action.mutate(next)}
    />
  );
}

function LibraryForm({
  state: { rating, lists },
  saving,
  saved,
  error,
  onAction,
}: {
  state: GameLibraryState;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onAction: (action: LibraryAction) => void;
}) {
  return (
    <section aria-labelledby="library-heading" className="space-y-3">
      <h2 id="library-heading" className="font-medium">
        Sua biblioteca
      </h2>
      <RatingButtons
        score={rating?.score ?? null}
        disabled={saving}
        onRate={(score) => onAction({ kind: 'rate', score })}
        onUnrate={() => onAction({ kind: 'unrate' })}
      />
      <div role="group" aria-label="Listas" className="flex flex-wrap gap-2">
        {LISTS.map(({ list, label }) => {
          const inList = lists.includes(list);
          return (
            <Button
              key={list}
              size="sm"
              variant={inList ? 'default' : 'outline'}
              aria-pressed={inList}
              disabled={saving}
              onClick={() => onAction({ kind: inList ? 'remove' : 'add', list })}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saving ? 'Salvando…' : saved ? 'Salvo.' : ''}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
