'use client';

import { type GameSummary, ONBOARDING_RATINGS_MAX } from '@indie/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { GameCard } from '@/features/games/game-card';
import { useLibraryAction } from '@/features/library/hooks';
import { RatingButtons } from '@/features/library/rating-buttons';
import { errorMessage } from '@/lib/api-client';
import { useOnboardingGames } from './hooks';

export const GAMES_PER_PAGE = 12;

export function RatingStep({ next }: { next: string }) {
  const games = useOnboardingGames();
  const [rated, setRated] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(GAMES_PER_PAGE);
  const full = rated.size >= ONBOARDING_RATINGS_MAX;

  const onRatedChange = (slug: string, isRated: boolean) =>
    setRated((previous) => {
      const updated = new Set(previous);
      if (isRated) updated.add(slug);
      else updated.delete(slug);
      return updated;
    });

  const finish = (
    <Link href={next} className={buttonVariants()}>
      {rated.size === 0 ? 'Pular' : 'Concluir'}
    </Link>
  );

  if (games.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando jogos para avaliar…</p>;
  }
  if (games.isError) {
    return (
      <div role="alert" className="space-y-2">
        <p>{errorMessage(games.error)}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm" variant="outline" onClick={() => void games.refetch()}>
            Tentar de novo
          </Button>
          {finish}
        </div>
      </div>
    );
  }

  const items = games.data.items;
  return (
    <div className="space-y-6">
      <p>
        É opcional: as notas deixam as recomendações mais certeiras. Dê 4 ou 5 aos que você curtiu e
        1 ou 2 aos que não curtiu.
      </p>
      {items.length === 0 ? (
        <p>Não encontramos jogos lançados com esses gostos para avaliar agora.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {items.slice(0, shown).map((game) => (
            <li key={game.slug}>
              <OnboardingGame game={game} full={full} onRatedChange={onRatedChange} />
            </li>
          ))}
        </ul>
      )}
      {shown < items.length && (
        <Button variant="outline" onClick={() => setShown((count) => count + GAMES_PER_PAGE)}>
          Mostrar mais jogos
        </Button>
      )}
      <div className="sticky bottom-0 space-y-2 border-t bg-background py-3">
        <p aria-live="polite" className="text-sm">
          {rated.size} de {ONBOARDING_RATINGS_MAX} avaliados
          {full && '. Para avaliar outro, remova uma das notas.'}
        </p>
        {finish}
      </div>
    </div>
  );
}

// Com o limite atingido, só os jogos já avaliados aceitam outra nota.
function OnboardingGame({
  game,
  full,
  onRatedChange,
}: {
  game: GameSummary;
  full: boolean;
  onRatedChange: (slug: string, rated: boolean) => void;
}) {
  const action = useLibraryAction(game.slug);
  const score = action.data?.rating?.score ?? null;
  const onSuccess = ({ rating }: { rating: unknown }) => onRatedChange(game.slug, rating !== null);

  return (
    <GameCard game={game}>
      <RatingButtons
        score={score}
        disabled={action.isPending || (full && score === null)}
        groupLabel={`Sua nota para ${game.name}`}
        onRate={(value) => action.mutate({ kind: 'rate', score: value }, { onSuccess })}
        onUnrate={() => action.mutate({ kind: 'unrate' }, { onSuccess })}
      />
      {action.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(action.error)}
        </p>
      )}
    </GameCard>
  );
}
