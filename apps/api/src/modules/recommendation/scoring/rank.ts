import { DiscoveryMode } from '../../../generated/prisma/client';
import type { ContentIndex, IndexedGame } from '../content-index';
import { type Profile, profileDot } from './profile';
import type { ScoringConfig } from './scoring-config';
import { type TieBreak, topBy } from './tie-break';

export interface RankOptions {
  mode: DiscoveryMode;
  limit: number;
  excludedGameIds: ReadonlySet<string>;
  tieBreak: TieBreak;
}

export interface RankedGame {
  game: IndexedGame;
  similarity: number;
  score: number;
  // Só no modo Descobertas: o jogo ficaria fora da lista se a ordem fosse só pelo cosseno.
  lowKnown: boolean;
}

type Candidate = Omit<RankedGame, 'lowKnown'>;

// score = cos(u, v) − λ_modo · pop. Só entra quem tem cosseno acima de zero, para ter ao menos
// um atributo a favor; jogo com vetor vazio não tem nenhum. Poucos candidatos dão lista menor.
export function rankCandidates(
  index: ContentIndex,
  profile: Profile,
  { mode, limit, excludedGameIds, tieBreak }: RankOptions,
  config: ScoringConfig,
): RankedGame[] {
  if (profile.norm === 0) return [];
  const lambda = config.popularityWeightByMode[mode];
  const candidates: Candidate[] = [];
  for (const game of index.games) {
    if (game.weights.length === 0 || excludedGameIds.has(game.id)) continue;
    const similarity = profileDot(profile, game) / profile.norm;
    if (similarity <= 0) continue;
    candidates.push({ game, similarity, score: similarity - lambda * game.popularityNorm });
  }

  const id = (c: Candidate) => c.game.id;
  const top = topBy(candidates, (c) => c.score, id, limit, tieBreak);
  const bySimilarity =
    mode === DiscoveryMode.DISCOVERY
      ? new Set(topBy(candidates, (c) => c.similarity, id, limit, tieBreak))
      : null;
  return top.map((c) => ({ ...c, lowKnown: bySimilarity !== null && !bySimilarity.has(c) }));
}
