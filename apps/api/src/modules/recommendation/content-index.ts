import type { FeatureType, ReleaseStatus } from '../../generated/prisma/client';
import { type FeatureKey, featureKey, type TfidfConfig, tfidfVector } from './tfidf';

export interface ContentIndexRows {
  // Só os atributos com IDF acima de zero: os descartados pelos limites não entram no vetor.
  features: { type: FeatureType; igdbId: number; slug: string; name: string; idf: number }[];
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
  type: FeatureType;
  slug: string;
  name: string;
}

// Vetor esparso com as posições em ordem crescente, para o produto escalar andar em paralelo.
export interface IndexedGame {
  id: string;
  slug: string;
  releaseStatus: ReleaseStatus;
  popularityNorm: number;
  featurePositions: Int32Array;
  weights: Float64Array;
}

export interface ContentIndex {
  games: readonly IndexedGame[];
  features: readonly IndexedFeature[];
  positionByGameId: ReadonlyMap<string, number>;
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

  const games = rows.games.map(({ featurePositions, ...game }) => {
    const features = featurePositions.map((position) => rows.features[position]!);
    const { weights } = tfidfVector(features, idf, config);
    const entries = [...weights]
      .map(([key, weight]) => [positionByKey.get(key)!, weight] as const)
      .sort(([a], [b]) => a - b);
    return {
      ...game,
      featurePositions: Int32Array.from(entries, ([position]) => position),
      weights: Float64Array.from(entries, ([, weight]) => weight),
    };
  });

  return {
    games,
    features: rows.features.map(({ type, slug, name }) => ({ type, slug, name })),
    positionByGameId: new Map(games.map(({ id }, position) => [id, position])),
  };
}
