'use client';

import type { DiscoveryMode, RecommendationOverview } from '@indie/contracts';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { clearAccount, useSession } from '@/features/auth/hooks';
import { CATALOG_PATH } from '@/features/catalog/search-params';
import { errorMessage, isUnauthorized } from '@/lib/api-client';
import { withRedirect } from '@/lib/safe-redirect';
import { useRecommendations, useSaveDiscoveryMode } from './hooks';
import { ModeSelector } from './mode-selector';
import { RecommendationCard } from './recommendation-card';

export const RECOMMENDATIONS_PATH = '/recomendacoes';

export function RecommendationsView() {
  const { data: user, isPending } = useSession();

  // Reserva o espaço enquanto a sessão carrega, para não mostrar o convite a quem já entrou.
  if (isPending) return <div aria-hidden="true" className="h-24" />;

  if (!user) {
    return (
      <p>
        <Link href={withRedirect('/entrar', RECOMMENDATIONS_PATH)} className="underline">
          Entre
        </Link>{' '}
        para ver suas recomendações.
      </p>
    );
  }

  return <Recommendations mode={user.discoveryMode} />;
}

function Recommendations({ mode }: { mode: DiscoveryMode }) {
  const queryClient = useQueryClient();
  const list = useRecommendations(mode);
  const saveMode = useSaveDiscoveryMode();

  // A sessão venceu: a página volta ao convite para entrar.
  useEffect(() => {
    if (isUnauthorized(list.error)) clearAccount(queryClient);
  }, [list.error, queryClient]);

  if (list.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando suas recomendações…</p>;
  }
  if (list.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar as recomendações</AlertTitle>
        <AlertDescription>
          <p>{errorMessage(list.error)}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={list.isFetching}
            onClick={() => void list.refetch()}
          >
            Tentar de novo
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Com a lista vazia ou de populares, o modo não muda nada, e trocá-lo pareceria quebrado. */}
      {list.data.basis === 'profile' && (
        <ModeSelector
          mode={mode}
          saving={saveMode.isPending}
          onSelect={(next) => saveMode.mutate(next)}
        />
      )}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saveMode.isPending ? 'Salvando…' : list.isPlaceholderData ? 'Atualizando…' : ''}
      </p>
      {saveMode.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(saveMode.error)}
        </p>
      )}
      <RecommendedGames list={list.data} updating={list.isPlaceholderData} />
    </div>
  );
}

function RecommendedGames({
  list: {
    mode,
    basis,
    main: { items },
  },
  updating,
}: {
  list: RecommendationOverview;
  updating: boolean;
}) {
  if (basis === 'empty') {
    return (
      <p>
        Avalie alguns jogos ou guarde nas suas listas para receber recomendações.{' '}
        <Link href={CATALOG_PATH} className="underline">
          Ver o catálogo
        </Link>
      </p>
    );
  }

  return (
    <section aria-label="Jogos recomendados" aria-busy={updating} className="space-y-6">
      {basis === 'popular' && (
        <p>
          Suas notas ainda não mostram do que você gosta; estes são jogos populares. Dê 4 ou 5 aos
          que você curtir.
        </p>
      )}
      {basis === 'profile' && mode === 'DISCOVERY' && (
        <p className="text-sm">Pouco conhecido: o jogo entrou na lista por ser menos popular.</p>
      )}
      {items.length > 0 ? (
        <ul className="space-y-6">
          {items.map((recommendation) => (
            <li key={recommendation.game.slug}>
              <RecommendationCard recommendation={recommendation} />
            </li>
          ))}
        </ul>
      ) : (
        <p>Não há jogos novos para recomendar com o seu perfil.</p>
      )}
    </section>
  );
}
