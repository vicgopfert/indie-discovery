import type { DiscoveryMode } from '../../../generated/prisma/client';
import type { ContentIndex, IndexedGame } from '../content-index';
import { type Profile, profileDot } from './profile';
import type { ScoringConfig } from './scoring-config';

export interface ScoringOptions {
  mode: DiscoveryMode;
  excludedGameIds: ReadonlySet<string>;
}

export interface ScoredCandidate {
  game: IndexedGame;
  similarity: number;
  score: number;
}

// score = cos(u, v) − λ_modo · pop, calculado uma vez por requisição para todos os candidatos: as
// listas são recortes deste conjunto. Só entra quem tem cosseno acima de zero, para ter ao menos
// um atributo a favor; jogo com vetor vazio não tem nenhum.
export function scoreCandidates(
  index: ContentIndex,
  profile: Profile,
  { mode, excludedGameIds }: ScoringOptions,
  config: ScoringConfig,
): ScoredCandidate[] {
  if (profile.norm === 0) return [];
  const lambda = config.popularityWeightByMode[mode];
  const candidates: ScoredCandidate[] = [];
  for (const game of index.games) {
    if (game.weights.length === 0 || excludedGameIds.has(game.id)) continue;
    const similarity = profileDot(profile, game) / profile.norm;
    if (similarity <= 0) continue;
    candidates.push({ game, similarity, score: similarity - lambda * game.popularityNorm });
  }
  return candidates;
}
