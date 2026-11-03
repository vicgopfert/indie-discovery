import type { FeatureType, ReleaseStatus } from '../../generated/prisma/client';
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
}

// Os pesos são refeitos a partir do IDF gravado na ingestão, com a mesma conta dela (tfidfVector).
export function buildContentIndex(rows: ContentIndexRows, config: TfidfConfig): ContentIndex {
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

  return {
    games,
    features: rows.features.map(({ id, type, slug, name }, position) => ({
      id,
      type,
      slug,
      name,
      documentRatio: rows.games.length === 0 ? 0 : documentCount[position]! / rows.games.length,
    })),
    positionByGameId: new Map(games.map(({ id }, position) => [id, position])),
    positionByFeatureId: new Map(rows.features.map(({ id }, position) => [id, position])),
    vectorOf,
  };
}
