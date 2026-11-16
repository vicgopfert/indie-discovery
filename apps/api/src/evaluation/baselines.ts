import type { ContentIndex, IndexedGame } from '../modules/recommendation/content-index';
import { isLabeledFeatureType } from '../modules/recommendation/content-index';
import { popularFallback } from '../modules/recommendation/scoring/fallback';
import { userTieBreak } from '../modules/recommendation/scoring/tie-break';
import type { RatedGame } from './profiles';
import { mulberry32 } from './random';

// Linha de base aleatória: `limit` jogos com vetor e fora da biblioteca, todos com a mesma chance.
export function randomBaseline(
  { games }: Pick<ContentIndex, 'games'>,
  excludedGameIds: ReadonlySet<string>,
  limit: number,
  seed: number,
): IndexedGame[] {
  let available = 0;
  for (const game of games) {
    if (game.weights.length > 0 && !excludedGameIds.has(game.id)) available++;
  }
  const random = mulberry32(seed);
  const picked = new Set<IndexedGame>();
  while (picked.size < Math.min(limit, available)) {
    const game = games[Math.floor(random() * games.length)]!;
    if (game.weights.length > 0 && !excludedGameIds.has(game.id)) picked.add(game);
  }
  return [...picked];
}

// Alternativa 1 da seção 12: os mais populares dos gêneros e temas dos jogos bem avaliados (nota 4
// ou mais) e das preferências, pelo mesmo caminho dos perfis sem componente positiva.
export function popularBaseline(
  index: ContentIndex,
  hidden: ReadonlySet<number>,
  {
    ratings,
    preferencePositions,
  }: { ratings: readonly RatedGame[]; preferencePositions: readonly number[] },
  excludedGameIds: ReadonlySet<string>,
  limit: number,
  userId: string,
): IndexedGame[] {
  const liked = ratings.flatMap(({ gameId, score }) => {
    const position = index.positionByGameId.get(gameId);
    if (score <= 3 || position === undefined) return [];
    return [...index.games[position]!.featurePositions].filter(
      (feature) => isLabeledFeatureType(index.features[feature]!.type) && !hidden.has(feature),
    );
  });
  return popularFallback(index, {
    limit,
    excludedGameIds,
    preferencePositions: [...new Set([...liked, ...preferencePositions])],
    tieBreak: userTieBreak(userId),
  }).map(({ game }) => game);
}
