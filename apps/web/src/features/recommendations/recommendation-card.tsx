import type { Recommendation } from '@indie/contracts';
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
      {/* Os atributos vão em texto: o motivo não diz qual é gênero, tema ou etiqueta, e o filtro
          do catálogo precisa saber. */}
      {reason && (
        <p className="text-sm">
          Recomendado por: {reason.features.map(({ name }) => name).join(', ')}
        </p>
      )}
    </GameCard>
  );
}
