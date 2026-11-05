import { RECOMMENDATION_REASONS_MAX } from '@indie/contracts';
import type { ContentIndex, IndexedGame } from '../content-index';
import type { ScoredReason } from './explain';
import type { TieBreak } from './tie-break';
import { topBy } from './top';

export interface FallbackOptions {
  limit: number;
  excludedGameIds: ReadonlySet<string>;
  preferencePositions: readonly number[];
  tieBreak: TieBreak;
}

export interface PopularGame {
  game: IndexedGame;
  reason: ScoredReason | null;
}

// Perfil sem componente positiva (só notas negativas ou neutras): os mais populares dos gêneros
// e temas preferidos, se algum candidato tiver um deles, ou do catálogo inteiro. O modo não muda
// esta lista; o motivo são os preferidos que o jogo tem.
export function popularFallback(
  index: ContentIndex,
  { limit, excludedGameIds, preferencePositions, tieBreak }: FallbackOptions,
): PopularGame[] {
  const preferred = new Set(preferencePositions);
  const candidates = index.games.filter(
    (game) => game.weights.length > 0 && !excludedGameIds.has(game.id),
  );
  const matching = candidates.filter((game) => game.featurePositions.some((p) => preferred.has(p)));
  return topBy(
    matching.length > 0 ? matching : candidates,
    (game) => game.popularityNorm,
    (game) => game.id,
    limit,
    tieBreak,
  ).map((game) => ({ game, reason: preferredReason(index, game, preferred) }));
}

function preferredReason(
  index: ContentIndex,
  game: IndexedGame,
  preferred: ReadonlySet<number>,
): ScoredReason | null {
  const entries = [...game.featurePositions]
    .map((position, i) => ({ position, weight: game.weights[i]! }))
    .filter(({ position }) => preferred.has(position))
    .sort((a, b) => b.weight - a.weight || a.position - b.position)
    .slice(0, RECOMMENDATION_REASONS_MAX);
  return entries.length > 0
    ? { kind: 'features', features: entries.map(({ position }) => index.features[position]!) }
    : null;
}
