import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { FeatureType } from '../../generated/prisma/client';
import type { MappedFeature } from './igdb.mapper';

const FEATURE_TYPES = [FeatureType.GENRE, FeatureType.THEME, FeatureType.KEYWORD] as const;

const perFeatureType = z.object({
  [FeatureType.GENRE]: z.number().positive(),
  [FeatureType.THEME]: z.number().positive(),
  [FeatureType.KEYWORD]: z.number().positive(),
});

export const tfidfConfigSchema = z.object({
  normalization: z.enum(['block', 'global']),
  normalizationRationale: z.string().min(1),
  blockShares: perFeatureType.refine(
    (shares) => Math.abs(shares.GENRE + shares.THEME + shares.KEYWORD - 1) < 1e-9,
    { message: 'As fatias dos blocos precisam somar 1.' },
  ),
  blockSharesRationale: z.string().min(1),
  globalTypeWeights: perFeatureType,
  minDocumentFrequency: z.number().int().positive(),
  maxDocumentRatio: z.number().positive().max(1),
  thresholdsRationale: z.string().min(1),
  excludedKeywordsRule: z.string().min(1),
  excludedKeywordPatterns: z.array(z.string().min(1)),
  excludedKeywords: z.array(z.string().min(1)),
});

export type TfidfConfig = z.infer<typeof tfidfConfigSchema>;

export const RECOMMENDATION_CONFIG_FILE = resolve(process.cwd(), 'config/recommendation.json');

export function readTfidfConfig(file = RECOMMENDATION_CONFIG_FILE): TfidfConfig {
  const { tfidf } = z
    .object({ tfidf: tfidfConfigSchema })
    .parse(JSON.parse(readFileSync(file, 'utf8')));
  return tfidf;
}

export type FeatureKey = `${FeatureType}:${number}`;
export type IdfTable = ReadonlyMap<FeatureKey, number>;

export interface TfidfVector {
  weights: ReadonlyMap<FeatureKey, number>;
  presentBlocks: readonly FeatureType[];
}

type Feature = Pick<MappedFeature, 'type' | 'igdbId' | 'name'>;

export function featureKey(feature: Pick<Feature, 'type' | 'igdbId'>): FeatureKey {
  return `${feature.type}:${feature.igdbId}`;
}

export function excludedKeywordMatcher(config: TfidfConfig) {
  const names = new Set(config.excludedKeywords.map((name) => name.toLowerCase()));
  const patterns = config.excludedKeywordPatterns.map((pattern) => new RegExp(pattern, 'i'));
  return (feature: Feature) =>
    feature.type === FeatureType.KEYWORD &&
    (names.has(feature.name.toLowerCase()) || patterns.some((p) => p.test(feature.name)));
}

// IDF = ln(N / df), só para atributos dentro dos limites de frequência e fora da lista de
// palavras-chave excluídas.
export function computeIdf(catalog: readonly Feature[][], config: TfidfConfig): IdfTable {
  const isExcluded = excludedKeywordMatcher(config);
  const documentFrequency = new Map<FeatureKey, number>();
  for (const features of catalog) {
    const keys = new Set(features.filter((f) => !isExcluded(f)).map(featureKey));
    for (const key of keys) documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1);
  }

  const total = catalog.length;
  const idf = new Map<FeatureKey, number>();
  for (const [key, df] of documentFrequency) {
    if (df >= config.minDocumentFrequency && df / total <= config.maxDocumentRatio) {
      idf.set(key, Math.log(total / df));
    }
  }
  return idf;
}

// Os atributos descartados ficam fora antes de qualquer normalização. No modo "block", cada tipo é
// normalizado separadamente e ocupa uma fatia fixa do vetor, para que o equilíbrio entre gêneros,
// temas e palavras-chave não dependa de quantos atributos de cada tipo o jogo tem; a fatia de um
// tipo ausente é redistribuída entre os presentes. No modo "global", todos os atributos são
// normalizados juntos, com o peso do tipo multiplicando o IDF. Nos dois, o vetor tem norma 1.
export function tfidfVector(
  features: readonly Pick<Feature, 'type' | 'igdbId'>[],
  idf: IdfTable,
  config: TfidfConfig,
): TfidfVector {
  const blocks = FEATURE_TYPES.map((type) => {
    const weights = new Map<FeatureKey, number>();
    for (const feature of features.filter((f) => f.type === type)) {
      const key = featureKey(feature);
      const featureIdf = idf.get(key);
      if (featureIdf !== undefined && featureIdf > 0) weights.set(key, featureIdf);
    }
    return { type, weights, norm: euclideanNorm(weights.values()) };
  }).filter((block) => block.norm > 0);

  const presentBlocks = blocks.map((b) => b.type);
  return {
    weights:
      config.normalization === 'block'
        ? blockNormalized(blocks, config)
        : globalNormalized(blocks, config),
    presentBlocks,
  };
}

type WeightedBlock = { type: FeatureType; weights: Map<FeatureKey, number>; norm: number };

function blockNormalized(blocks: WeightedBlock[], config: TfidfConfig) {
  const presentShare = blocks.reduce((sum, b) => sum + config.blockShares[b.type], 0);
  const weights = new Map<FeatureKey, number>();
  for (const { type, weights: blockWeights, norm } of blocks) {
    const scale = Math.sqrt(config.blockShares[type] / presentShare) / norm;
    for (const [key, w] of blockWeights) weights.set(key, w * scale);
  }
  return weights;
}

function globalNormalized(blocks: WeightedBlock[], config: TfidfConfig) {
  const weighted = blocks.flatMap(({ type, weights }) =>
    [...weights].map(([key, w]) => [key, w * config.globalTypeWeights[type]] as const),
  );
  const norm = euclideanNorm(weighted.map(([, w]) => w));
  return new Map(weighted.map(([key, w]) => [key, w / norm]));
}

function euclideanNorm(values: Iterable<number>) {
  let sum = 0;
  for (const value of values) sum += value * value;
  return Math.sqrt(sum);
}
