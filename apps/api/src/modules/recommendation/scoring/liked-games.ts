import { ListType } from '../../../generated/prisma/client';
import type { ContentVector } from '../content-index';
import type { Interest } from './interests';
import { type Interaction, interactionWeight } from './profile';
import type { ScoringConfig } from './scoring-config';

export interface LikedGame {
  gameId: string;
  slug: string;
  vector: ContentVector;
}

// Os jogos de origem das prateleiras "Porque você gostou de <jogo>": nota a partir do mínimo ou
// favorito, com peso positivo no perfil. Um jogo só em "quero jogar" ou só em "concluídos" não diz
// que o jogador gostou dele. Primeiro os que nenhuma prateleira de interesse cobre, o gosto de um
// jogo só; depois o de maior peso e, no empate, o curtido mais recentemente.
export function pickLikedGames(
  interactions: readonly Interaction[],
  interests: readonly Interest[],
  config: ScoringConfig,
): LikedGame[] {
  const { likedGameShelves, likedGameMinScore } = config.lists;
  const covered = new Set(interests.flatMap(({ supportGameIds }) => supportGameIds));
  const liked = (interaction: Interaction) =>
    (interaction.score !== null && interaction.score >= likedGameMinScore) ||
    interaction.lists.includes(ListType.FAVORITE);

  return interactions
    .flatMap((interaction) => {
      const { vector } = interaction;
      const weight = interactionWeight(interaction, config);
      if (!liked(interaction) || weight <= 0 || vector === null || vector.weights.length === 0) {
        return [];
      }
      return [{ ...interaction, vector, weight, uncovered: !covered.has(interaction.gameId) }];
    })
    .sort(
      (a, b) =>
        Number(b.uncovered) - Number(a.uncovered) ||
        b.weight - a.weight ||
        (b.likedAt ?? 0) - (a.likedAt ?? 0) ||
        (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0),
    )
    .slice(0, likedGameShelves)
    .map(({ gameId, slug, vector }) => ({ gameId, slug, vector }));
}
