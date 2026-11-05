import type { Recommendation } from '@indie/contracts';
import { RecommendationCard } from './recommendation-card';

// Duas colunas a partir das telas médias, uma no celular: a visão geral tem até 70 cartões.
export function RecommendationGrid({
  items,
  headingLevel,
}: {
  items: readonly Recommendation[];
  headingLevel: 'h2' | 'h3';
}) {
  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {items.map((recommendation) => (
        <li key={recommendation.game.slug}>
          <RecommendationCard recommendation={recommendation} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
