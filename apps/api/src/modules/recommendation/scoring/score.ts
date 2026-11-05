import type { DiscoveryMode } from '../../../generated/prisma/client';
import type { ContentIndex } from '../content-index';
import { type Profile, profileDot } from './profile';
import type { ScoringConfig } from './scoring-config';

export interface ScoringOptions {
  mode: DiscoveryMode;
  excludedGameIds: ReadonlySet<string>;
}

// Um candidato por posição k, em vetores paralelos: a posição do jogo no índice, o cosseno e a
// pontuação. São cerca de 17 mil candidatos por requisição; um objeto para cada um custava quase
// 2 MB alocados por requisição (B-76).
export interface ScoredCandidates {
  count: number;
  gamePositions: Int32Array;
  similarity: Float64Array;
  score: Float64Array;
}

// score = cos(u, v) − λ_modo · pop, calculado uma vez por requisição para todos os candidatos: as
// listas são recortes deste conjunto. Só entra quem tem cosseno acima de zero, para ter ao menos
// um atributo a favor; jogo com vetor vazio não tem nenhum.
export function scoreCandidates(
  index: Pick<ContentIndex, 'games' | 'positionByGameId'>,
  profile: Profile,
  { mode, excludedGameIds }: ScoringOptions,
  config: ScoringConfig,
): ScoredCandidates {
  const total = index.games.length;
  const candidates = {
    count: 0,
    gamePositions: new Int32Array(total),
    similarity: new Float64Array(total),
    score: new Float64Array(total),
  };
  if (profile.norm === 0) return candidates;

  const excluded = new Uint8Array(total);
  for (const gameId of excludedGameIds) {
    const position = index.positionByGameId.get(gameId);
    if (position !== undefined) excluded[position] = 1;
  }
  const lambda = config.popularityWeightByMode[mode];
  for (let position = 0; position < total; position++) {
    const game = index.games[position]!;
    if (game.weights.length === 0 || excluded[position] === 1) continue;
    const similarity = profileDot(profile, game) / profile.norm;
    if (similarity <= 0) continue;
    const k = candidates.count++;
    candidates.gamePositions[k] = position;
    candidates.similarity[k] = similarity;
    candidates.score[k] = similarity - lambda * game.popularityNorm;
  }
  return candidates;
}
