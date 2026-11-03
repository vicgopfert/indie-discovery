import type { DiscoveryMode } from '../../../generated/prisma/client';
import type { ContentIndex, IndexedGame } from '../content-index';
import { explain, type RecommendationReason } from './explain';
import { popularFallback } from './fallback';
import { pickInterests } from './interests';
import { buildLists, MAIN_LIST_KEY, type RankedList } from './lists';
import { buildProfile, hasPositiveComponent, type Interaction } from './profile';
import { scoreCandidates } from './rank';
import type { ScoringConfig } from './scoring-config';
import { userTieBreak } from './tie-break';

export interface RecommendationInput {
  userId: string;
  mode: DiscoveryMode;
  // Avaliações e listas, um item por jogo.
  interactions: readonly Interaction[];
  // Posições, no índice, dos gêneros e temas escolhidos na partida a frio.
  preferencePositions: readonly number[];
  // Posições dos gêneros e temas escondidos dos filtros, que não viram interesse.
  hiddenPositions: ReadonlySet<number>;
}

// profile: pelo perfil; popular: perfil sem componente positiva, inclusive o vazio, só com a
// lista principal. Quem não tem avaliações, listas nem preferências gravadas vai antes para a
// partida a frio, no caso de uso.
export interface RecommendationLists {
  basis: 'profile' | 'popular';
  // Na ordem da página, a principal primeiro.
  lists: readonly RankedList[];
  // Calculado só para os jogos mostrados.
  reasonOf(game: IndexedGame): RecommendationReason | null;
}

export function recommend(
  index: ContentIndex,
  input: RecommendationInput,
  config: ScoringConfig,
): RecommendationLists {
  const { mode, interactions, preferencePositions } = input;
  const excludedGameIds = new Set(interactions.map(({ gameId }) => gameId));
  const tieBreak = userTieBreak(input.userId);
  const profile = buildProfile(interactions, preferencePositions, index.features.length, config);

  if (!hasPositiveComponent(profile)) {
    const popular = popularFallback(index, {
      limit: config.lists.mainCap,
      excludedGameIds,
      preferencePositions,
      tieBreak,
    });
    const reasons = new Map(popular.map(({ game, reason }) => [game.id, reason]));
    return {
      basis: 'popular',
      lists: [
        {
          key: MAIN_LIST_KEY,
          kind: 'main',
          feature: null,
          games: popular.map(({ game }) => game),
          bySimilarity: null,
        },
      ],
      reasonOf: (game) => reasons.get(game.id) ?? null,
    };
  }

  const interests = pickInterests(
    profile,
    preferencePositions,
    index.features,
    input.hiddenPositions,
    config,
  );
  const candidates = scoreCandidates(index, profile, { mode, excludedGameIds }, config);
  return {
    basis: 'profile',
    lists: buildLists(candidates, index.features, { mode, interests, tieBreak }, config.lists),
    reasonOf: (game) => explain(profile, game, index.features),
  };
}
