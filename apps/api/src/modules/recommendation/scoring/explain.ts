import { RECOMMENDATION_REASONS_MAX } from '@indie/contracts';
import { FeatureType } from '../../../generated/prisma/client';
import {
  type ContentIndex,
  type ContentVector,
  type DisplayedAttribute,
  type IndexedFeature,
  type IndexedGame,
  isLabeledFeatureType,
} from '../content-index';
import type { Profile } from './profile';

// O motivo calculado, antes dos nomes traduzidos e dos dados do jogo curtido.
export type ScoredReason =
  { kind: 'features'; features: DisplayedAttribute[] } | { kind: 'liked-game'; gameId: string };

// A ordem dos grupos do motivo (B-78): primeiro as etiquetas que podem virar prateleira, que dizem
// o tipo de jogo; depois as outras etiquetas (visuais e vagas); depois gêneros e temas da IGDB.
// Assim o motivo fala o vocabulário das etiquetas e não repete a mesma ideia ("Aventura,
// Aventura") pelas duas fontes.
const REASON_GROUPS = 3;

function reasonGroup({ type, shelf }: IndexedFeature): number | null {
  if (type === FeatureType.TAG) return shelf ? 0 : 1;
  return isLabeledFeatureType(type) ? 2 : null;
}

// Os atributos de maior contribuição positiva, u_k · v_jk / (‖u‖ · ‖v_j‖), do primeiro grupo que
// tem alguma: o motivo só mostra o que contribuiu para a pontuação (B-74). Sem nenhum, o jogo da
// biblioteca de maior w_i · cos(v_i, v_j), que existe sempre que o cosseno é positivo: a
// contribuição veio de um atributo que algum jogo de peso positivo também tem. Com as etiquetas no
// vetor, todo atributo dele está num dos grupos: o jogo curtido só aparece se entrar no vetor um
// tipo de atributo que não vira motivo.
export function explainer(profile: Profile, { features }: Pick<ContentIndex, 'features'>) {
  return (game: IndexedGame): ScoredReason | null => {
    const groups = Array.from({ length: REASON_GROUPS }, () => [] as Contribution[]);
    for (let i = 0; i < game.featurePositions.length; i++) {
      const position = game.featurePositions[i]!;
      const value = (profile.vector[position]! * game.weights[i]!) / profile.norm;
      if (value <= 0) continue;
      const feature = features[position]!;
      const group = reasonGroup(feature);
      if (group !== null) groups[group]!.push({ feature, position, value });
    }
    const contributions = groups.find((group) => group.length > 0);
    if (contributions) {
      return {
        kind: 'features',
        features: contributions
          .sort((a, b) => b.value - a.value || a.position - b.position)
          .slice(0, RECOMMENDATION_REASONS_MAX)
          .map(({ feature: { type, slug, name } }) => ({ type, slug, name })),
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

interface Contribution {
  feature: IndexedFeature;
  position: number;
  value: number;
}

// Com norma 1 nos dois vetores, o produto escalar é o cosseno. As posições estão em ordem.
function sparseDot(a: ContentVector, b: ContentVector): number {
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
