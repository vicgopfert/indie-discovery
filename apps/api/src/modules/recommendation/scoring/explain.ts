import { FeatureType } from '../../../generated/prisma/client';
import type { IndexedFeature, IndexedGame } from '../content-index';
import type { Profile, SparseVector } from './profile';

// Palavras-chave nunca viram motivo: não têm tradução e, raras, pesam mais justamente nos jogos
// com poucas etiquetas, com motivos como "anxiety" ou "rock climbing" (B-12).
const REASON_TYPES: ReadonlySet<FeatureType> = new Set([FeatureType.GENRE, FeatureType.THEME]);
const MAX_REASONS = 3;

export type RecommendationReason =
  { kind: 'features'; features: IndexedFeature[] } | { kind: 'liked-game'; gameId: string };

// Os gêneros e temas de maior contribuição positiva, u_k · v_jk / (‖u‖ · ‖v_j‖). Sem nenhum, o
// jogo da biblioteca de maior w_i · cos(v_i, v_j), que existe sempre que o cosseno é positivo:
// a contribuição veio de um atributo que algum jogo de peso positivo também tem.
export function explain(
  profile: Profile,
  game: IndexedGame,
  features: readonly IndexedFeature[],
): RecommendationReason | null {
  const contributions: { position: number; value: number }[] = [];
  for (let i = 0; i < game.featurePositions.length; i++) {
    const position = game.featurePositions[i]!;
    if (!REASON_TYPES.has(features[position]!.type)) continue;
    const value = (profile.vector[position]! * game.weights[i]!) / profile.norm;
    if (value > 0) contributions.push({ position, value });
  }
  if (contributions.length > 0) {
    return {
      kind: 'features',
      features: contributions
        .sort((a, b) => b.value - a.value || a.position - b.position)
        .slice(0, MAX_REASONS)
        .map(({ position }) => features[position]!),
    };
  }

  let liked: { gameId: string; value: number } | null = null;
  for (const { gameId, weight, vector } of profile.games) {
    const value = weight * sparseDot(vector, game);
    if (value <= 0) continue;
    if (liked === null || value > liked.value || (value === liked.value && gameId < liked.gameId)) {
      liked = { gameId, value };
    }
  }
  return liked && { kind: 'liked-game', gameId: liked.gameId };
}

// Com norma 1 nos dois vetores, o produto escalar é o cosseno. As posições estão em ordem.
function sparseDot(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  for (let i = 0, j = 0; i < a.featurePositions.length && j < b.featurePositions.length;) {
    const pa = a.featurePositions[i]!;
    const pb = b.featurePositions[j]!;
    if (pa === pb) dot += a.weights[i++]! * b.weights[j++]!;
    else if (pa < pb) i++;
    else j++;
  }
  return dot;
}
