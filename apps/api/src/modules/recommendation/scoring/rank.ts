import { DiscoveryMode } from '../../../generated/prisma/client';
import type { ContentIndex, IndexedGame } from '../content-index';
import { type Profile, profileDot } from './profile';
import type { ScoringConfig } from './scoring-config';
import { type TieBreak, topBy } from './tie-break';

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

export interface RankOptions extends ScoringOptions {
  limit: number;
  tieBreak: TieBreak;
}

export interface RankedGame extends ScoredCandidate {
  // Só no modo Descobertas: o jogo ficaria fora da lista se a ordem fosse só pelo cosseno.
  lowKnown: boolean;
}

// Os mais bem pontuados até o limite. Poucos candidatos dão lista menor.
export function rankCandidates(
  index: ContentIndex,
  profile: Profile,
  { mode, limit, excludedGameIds, tieBreak }: RankOptions,
  config: ScoringConfig,
): RankedGame[] {
  const candidates = scoreCandidates(index, profile, { mode, excludedGameIds }, config);
  const id = (c: ScoredCandidate) => c.game.id;
  const top = topBy(candidates, (c) => c.score, id, limit, tieBreak);
  const bySimilarity =
    mode === DiscoveryMode.DISCOVERY
      ? new Set(topBy(candidates, (c) => c.similarity, id, limit, tieBreak))
      : null;
  return top.map((c) => ({ ...c, lowKnown: bySimilarity !== null && !bySimilarity.has(c) }));
}
