import { RECOMMENDATION_REASONS_MAX } from '@indie/contracts';
import { FeatureType } from '../../../generated/prisma/client';
import type { ContentIndex, IndexedFeature, IndexedGame } from '../content-index';
import type { Profile, SparseVector } from './profile';

// Palavras-chave nunca viram motivo sozinhas: não têm tradução e, raras, pesam mais justamente nos
// jogos com poucas etiquetas, com motivos como "anxiety" ou "rock climbing" (B-12). Só entram
// agrupadas e traduzidas pelo estilo (B-74).
const REASON_TYPES: ReadonlySet<FeatureType> = new Set([FeatureType.GENRE, FeatureType.THEME]);

export type ReasonAttribute = Pick<IndexedFeature, 'slug' | 'name'> & {
  type: FeatureType | 'STYLE';
};

export type RecommendationReason =
  { kind: 'features'; features: ReasonAttribute[] } | { kind: 'liked-game'; gameId: string };

export type ReasonCatalog = Pick<ContentIndex, 'features' | 'styles'>;

// Os gêneros, temas e estilos de maior contribuição positiva, u_k · v_jk / (‖u‖ · ‖v_j‖). A do
// estilo é a soma das palavras-chave dele no vetor do jogo, para a explicação continuar exata: o
// estilo que veio só do resumo não contribuiu para a pontuação e não entra. Sem nenhum, o jogo da
// biblioteca de maior w_i · cos(v_i, v_j), que existe sempre que o cosseno é positivo: a
// contribuição veio de um atributo que algum jogo de peso positivo também tem.
export function explainer(profile: Profile, { features, styles }: ReasonCatalog) {
  const styleByPosition = new Map<number, number>();
  styles.forEach(({ keywordPositions }, style) => {
    for (const position of keywordPositions) styleByPosition.set(position, style);
  });

  return (game: IndexedGame): RecommendationReason | null => {
    const contributions: { attribute: ReasonAttribute; order: number; value: number }[] = [];
    const styleSums = new Map<number, number>();
    for (let i = 0; i < game.featurePositions.length; i++) {
      const position = game.featurePositions[i]!;
      const feature = features[position]!;
      const value = (profile.vector[position]! * game.weights[i]!) / profile.norm;
      if (REASON_TYPES.has(feature.type)) {
        if (value > 0) contributions.push({ attribute: feature, order: position, value });
        continue;
      }
      const style = styleByPosition.get(position);
      if (style !== undefined) styleSums.set(style, (styleSums.get(style) ?? 0) + value);
    }
    for (const [style, value] of styleSums) {
      if (value <= 0) continue;
      const { slug, name } = styles[style]!;
      contributions.push({
        attribute: { type: 'STYLE', slug, name },
        order: features.length + style,
        value,
      });
    }
    if (contributions.length > 0) {
      return {
        kind: 'features',
        features: contributions
          .sort((a, b) => b.value - a.value || a.order - b.order)
          .slice(0, RECOMMENDATION_REASONS_MAX)
          .map(({ attribute }) => attribute),
      };
    }

    let liked: { gameId: string; value: number } | null = null;
    for (const { gameId, weight, vector } of profile.games) {
      const value = weight * sparseDot(vector, game);
      if (value <= 0) continue;
      if (
        liked === null ||
        value > liked.value ||
        (value === liked.value && gameId < liked.gameId)
      ) {
        liked = { gameId, value };
      }
    }
    return liked && { kind: 'liked-game', gameId: liked.gameId };
  };
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
