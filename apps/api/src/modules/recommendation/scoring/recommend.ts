import type { DiscoveryMode } from '../../../generated/prisma/client';
import type { ContentIndex, IndexedGame } from '../content-index';
import { explain, type RecommendationReason } from './explain';
import { popularFallback } from './fallback';
import { buildProfile, hasPositiveComponent, type Interaction } from './profile';
import { rankCandidates } from './rank';
import type { ScoringConfig } from './scoring-config';
import { userTieBreak } from './tie-break';

export interface RecommendationInput {
  userId: string;
  mode: DiscoveryMode;
  limit: number;
  // Avaliações e listas, um item por jogo.
  interactions: readonly Interaction[];
  // Posições, no índice, dos gêneros e temas escolhidos na partida a frio.
  preferencePositions: readonly number[];
}

export interface Recommendation {
  game: IndexedGame;
  // A pontuação do modo; na lista de populares, a popularidade.
  score: number;
  reason: RecommendationReason | null;
  lowKnown: boolean;
}

// profile: pelo perfil; popular: perfil sem componente positiva; empty: nada a partir do que
// recomendar, o jogador vai para a partida a frio.
export interface RecommendationResult {
  basis: 'profile' | 'popular' | 'empty';
  items: Recommendation[];
}

export function recommend(
  index: ContentIndex,
  input: RecommendationInput,
  config: ScoringConfig,
): RecommendationResult {
  const { interactions, preferencePositions, limit } = input;
  if (interactions.length === 0 && preferencePositions.length === 0) {
    return { basis: 'empty', items: [] };
  }

  const excludedGameIds = new Set(interactions.map(({ gameId }) => gameId));
  const tieBreak = userTieBreak(input.userId);
  const profile = buildProfile(interactions, preferencePositions, index.features.length, config);

  if (!hasPositiveComponent(profile)) {
    return {
      basis: 'popular',
      items: popularFallback(index, {
        limit,
        excludedGameIds,
        preferencePositions,
        tieBreak,
      }).map(({ game, reason }) => ({
        game,
        score: game.popularityNorm,
        reason,
        lowKnown: false,
      })),
    };
  }

  return {
    basis: 'profile',
    items: rankCandidates(
      index,
      profile,
      { mode: input.mode, limit, excludedGameIds, tieBreak },
      config,
    ).map(({ game, score, lowKnown }) => ({
      game,
      score,
      reason: explain(profile, game, index.features),
      lowKnown,
    })),
  };
}
