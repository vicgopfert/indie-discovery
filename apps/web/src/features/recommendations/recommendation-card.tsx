import type { Recommendation, RecommendationReason } from '@indie/contracts';
import Link from 'next/link';
import { GameCard } from '@/features/games/game-card';

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const { game, reason, lowKnown } = recommendation;
  return (
    <GameCard game={game}>
      {lowKnown && (
        <span className="inline-block rounded-md border px-2 py-0.5 text-xs font-medium">
          Pouco conhecido
        </span>
      )}
      {reason && <Reason reason={reason} />}
    </GameCard>
  );
}

// Os gêneros e temas vão em texto: o motivo não diz qual é gênero e qual é tema, e o filtro do
// catálogo precisa saber.
function Reason({ reason }: { reason: RecommendationReason }) {
  if (reason.kind === 'features') {
    return (
      <p className="text-sm">
        Recomendado por: {reason.features.map(({ name }) => name).join(', ')}
      </p>
    );
  }

  const { game } = reason;
  return (
    <p className="text-sm">
      Porque você gostou de{' '}
      {game.inCatalog ? (
        <Link href={`/jogos/${game.slug}`} className="underline">
          {game.name}
        </Link>
      ) : (
        game.name
      )}
    </p>
  );
}
