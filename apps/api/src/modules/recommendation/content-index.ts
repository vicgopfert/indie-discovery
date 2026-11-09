import { FeatureType, type ReleaseStatus } from '../../generated/prisma/client';
import type { LabeledFeatureType } from '../catalog/feature-labels';
import {
  type ContentFeature,
  type FeatureKey,
  featureKey,
  type TfidfConfig,
  tfidfVector,
} from './tfidf';

export interface ContentIndexRows {
  // Só os atributos com IDF acima de zero: os descartados pelos limites não entram no vetor.
  features: {
    id: string;
    type: FeatureType;
    igdbId: number;
    slug: string;
    name: string;
    idf: number;
  }[];
  // featurePositions aponta para a lista de atributos acima.
  games: {
    id: string;
    slug: string;
    releaseStatus: ReleaseStatus;
    popularityNorm: number;
    featurePositions: number[];
  }[];
}

export interface IndexedFeature {
  id: string;
  type: FeatureType;
  slug: string;
  name: string;
  // Fração dos jogos do índice que têm o atributo.
  documentRatio: number;
  // Pode virar prateleira: gêneros e temas sempre, e as etiquetas marcadas no vocabulário. As
  // visuais e as vagas ficam na pontuação, no filtro e, por último, no motivo.
  shelf: boolean;
  // Etiqueta de gênero ou subgênero, que diz o tipo de jogo: a fase 1 da regra de prateleiras.
  gameKind: boolean;
  // O título do vocabulário em "Porque você curte <título>"; sem ele, vale o nome.
  title: string | null;
  // Dois atributos com a mesma ideia não viram duas prateleiras: o gênero ou tema da IGDB vale
  // pela própria chave, e a etiqueta, pelo gênero ou tema equivalente do vocabulário.
  idea: string;
}

// O que o vocabulário diz de cada etiqueta que pode virar prateleira.
export interface ShelfTag {
  gameKind: boolean;
  title: string | null;
  sameIdeaAs: string | null;
}

// Gêneros e temas têm o nome traduzido pelo arquivo de rótulos; as etiquetas já vêm em português
// do vocabulário (B-78).
export function isLabeledFeatureType(type: FeatureType): type is LabeledFeatureType {
  return type === FeatureType.GENRE || type === FeatureType.THEME;
}

// O atributo de uma prateleira ou de um motivo.
export interface DisplayedAttribute {
  type: FeatureType;
  slug: string;
  name: string;
}

// Vetor esparso com as posições em ordem crescente, para o produto escalar andar em paralelo.
export interface ContentVector {
  featurePositions: Int32Array;
  weights: Float64Array;
}

export interface IndexedGame extends ContentVector {
  id: string;
  slug: string;
  releaseStatus: ReleaseStatus;
  popularityNorm: number;
}

export interface ContentIndex {
  games: readonly IndexedGame[];
  features: readonly IndexedFeature[];
  positionByGameId: ReadonlyMap<string, number>;
  positionByFeatureId: ReadonlyMap<string, number>;
  // O vetor de um jogo fora do índice (o que saiu do catálogo e continua na biblioteca), com o
  // mesmo IDF e as mesmas posições: atributo fora do índice fica de fora, como nos outros jogos.
  vectorOf(features: readonly Pick<ContentFeature, 'type' | 'igdbId'>[]): ContentVector;
  // Jaccard entre os jogos do índice que têm cada um dos dois atributos.
  catalogJaccard(a: number, b: number): number;
}

// Os pesos são refeitos a partir do IDF gravado na ingestão, com a mesma conta dela (tfidfVector).
// shelfTags: as etiquetas que podem virar prateleira, pelo id da Steam.
export function buildContentIndex(
  rows: ContentIndexRows,
  config: TfidfConfig,
  shelfTags: ReadonlyMap<number, ShelfTag>,
): ContentIndex {
  const idf = new Map<FeatureKey, number>();
  const positionByKey = new Map<FeatureKey, number>();
  rows.features.forEach((feature, position) => {
    const key = featureKey(feature);
    idf.set(key, feature.idf);
    positionByKey.set(key, position);
  });

  const vectorOf = (features: readonly Pick<ContentFeature, 'type' | 'igdbId'>[]) => {
    const entries = [...tfidfVector(features, idf, config).weights]
      .map(([key, weight]) => [positionByKey.get(key)!, weight] as const)
      .sort(([a], [b]) => a - b);
    return {
      featurePositions: Int32Array.from(entries, ([position]) => position),
      weights: Float64Array.from(entries, ([, weight]) => weight),
    };
  };

  const games = rows.games.map(({ featurePositions, ...game }) => ({
    ...game,
    ...vectorOf(featurePositions.map((position) => rows.features[position]!)),
  }));

  const documentCount = new Array<number>(rows.features.length).fill(0);
  for (const { featurePositions } of rows.games) {
    for (const position of featurePositions) documentCount[position]!++;
  }
  const ratio = (count: number) => (rows.games.length === 0 ? 0 : count / rows.games.length);
  const gamesWith = postings(rows.games, documentCount);
  const jaccardMemo = new Map<number, number>();

  return {
    games,
    features: rows.features.map(({ id, type, igdbId, slug, name }, position) => {
      const tag = type === FeatureType.TAG ? shelfTags.get(igdbId) : undefined;
      const key = `${type.toLowerCase()}:${slug}`;
      return {
        id,
        type,
        slug,
        name,
        documentRatio: ratio(documentCount[position]!),
        shelf: isLabeledFeatureType(type) || tag !== undefined,
        gameKind: tag?.gameKind ?? false,
        title: tag?.title ?? null,
        idea: tag?.sameIdeaAs ?? key,
      };
    }),
    positionByGameId: new Map(games.map(({ id }, position) => [id, position])),
    positionByFeatureId: new Map(rows.features.map(({ id }, position) => [id, position])),
    vectorOf,
    // Poucos pares chegam a ser comparados (os atributos das bibliotecas, contra até 6
    // prateleiras), e cada um custa uma passada pelos jogos dos dois: calculado na primeira vez.
    catalogJaccard(a, b) {
      if (a === b) return 1;
      const key = Math.min(a, b) * rows.features.length + Math.max(a, b);
      let value = jaccardMemo.get(key);
      if (value === undefined) {
        value = sortedJaccard(gamesWith[a]!, gamesWith[b]!);
        jaccardMemo.set(key, value);
      }
      return value;
    },
  };
}

// As posições dos jogos de cada atributo, em ordem crescente.
function postings(
  games: ContentIndexRows['games'],
  documentCount: readonly number[],
): Int32Array[] {
  const lists = documentCount.map((count) => new Int32Array(count));
  const filled = new Array<number>(documentCount.length).fill(0);
  games.forEach(({ featurePositions }, game) => {
    for (const position of featurePositions) lists[position]![filled[position]!++] = game;
  });
  return lists;
}

function sortedJaccard(a: Int32Array, b: Int32Array): number {
  let both = 0;
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) {
      both++;
      i++;
      j++;
    } else if (a[i]! < b[j]!) i++;
    else j++;
  }
  const union = a.length + b.length - both;
  return union === 0 ? 0 : both / union;
}
