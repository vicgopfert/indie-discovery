import { FeatureType, type ReleaseStatus } from '../../generated/prisma/client';
import type { LabeledFeatureType } from '../catalog/feature-labels';
import { type CuratedStyle, styleAssigner, type StyleSource } from '../styles/styles';
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
  // featurePositions aponta para a lista de atributos acima. O resumo e as palavras-chave de
  // algum estilo (inclusive as descartadas pelo TF-IDF) servem só para atribuir os estilos.
  games: {
    id: string;
    slug: string;
    releaseStatus: ReleaseStatus;
    popularityNorm: number;
    featurePositions: number[];
    summary: string;
    styleKeywords: string[];
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

export interface IndexedStyle {
  slug: string;
  name: string;
  // Fração dos jogos do índice que têm o estilo.
  documentRatio: number;
  // As palavras-chave do estilo que estão no vetor: a contribuição delas é a do estilo no motivo.
  keywordPositions: readonly number[];
}

// Gêneros e temas têm nome traduzido e viram interesse e motivo; as palavras-chave, raras e sem
// tradução, só entram agrupadas nos estilos (B-12, B-74).
export function isLabeledFeatureType(type: FeatureType): type is LabeledFeatureType {
  return type === FeatureType.GENRE || type === FeatureType.THEME;
}

// O atributo de uma prateleira ou de um motivo: um atributo do vetor ou um estilo curado.
export interface DisplayedAttribute {
  type: FeatureType | 'STYLE';
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
  // Índices em ContentIndex.styles, em ordem crescente.
  styles: readonly number[];
}

export interface ContentIndex {
  games: readonly IndexedGame[];
  features: readonly IndexedFeature[];
  styles: readonly IndexedStyle[];
  positionByGameId: ReadonlyMap<string, number>;
  positionByFeatureId: ReadonlyMap<string, number>;
  // O estilo de cada palavra-chave de estilo que está no vetor, pela posição dela, para o motivo.
  styleByKeywordPosition: ReadonlyMap<number, number>;
  // O vetor de um jogo fora do índice (o que saiu do catálogo e continua na biblioteca), com o
  // mesmo IDF e as mesmas posições: atributo fora do índice fica de fora, como nos outros jogos.
  vectorOf(features: readonly Pick<ContentFeature, 'type' | 'igdbId'>[]): ContentVector;
  // Os estilos desse mesmo jogo, pela mesma regra da carga.
  stylesOf(source: StyleSource): number[];
}

// A parte do índice que dá nome aos atributos: os do vetor e os estilos.
export type AttributeCatalog = Pick<ContentIndex, 'features' | 'styles'>;

// Os pesos são refeitos a partir do IDF gravado na ingestão, com a mesma conta dela (tfidfVector).
// Os estilos são atribuídos aqui, na carga, pelas palavras-chave e pelo resumo (B-74).
export function buildContentIndex(
  rows: ContentIndexRows,
  config: TfidfConfig,
  styles: readonly CuratedStyle[],
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
  const stylesOf = styleAssigner(styles);

  const games = rows.games.map(({ featurePositions, summary, styleKeywords, ...game }) => ({
    ...game,
    ...vectorOf(featurePositions.map((position) => rows.features[position]!)),
    styles: stylesOf({ keywords: styleKeywords, summary }),
  }));

  const ratio = (count: number) => (rows.games.length === 0 ? 0 : count / rows.games.length);
  const documentCount = new Array<number>(rows.features.length).fill(0);
  for (const { featurePositions } of rows.games) {
    for (const position of featurePositions) documentCount[position]!++;
  }
  const styleCount = new Array<number>(styles.length).fill(0);
  for (const game of games) for (const style of game.styles) styleCount[style]!++;

  const indexedStyles = styles.map(({ slug, name, keywords }, i) => {
    const own = new Set(keywords.map((k) => k.toLowerCase()));
    return {
      slug,
      name,
      documentRatio: ratio(styleCount[i]!),
      keywordPositions: rows.features.flatMap((feature, position) =>
        feature.type === FeatureType.KEYWORD && own.has(feature.slug.toLowerCase())
          ? [position]
          : [],
      ),
    };
  });

  return {
    games,
    features: rows.features.map(({ id, type, slug, name }, position) => ({
      id,
      type,
      slug,
      name,
      documentRatio: ratio(documentCount[position]!),
    })),
    styles: indexedStyles,
    styleByKeywordPosition: new Map(
      indexedStyles.flatMap(({ keywordPositions }, style) =>
        keywordPositions.map((position) => [position, style] as const),
      ),
    ),
    positionByGameId: new Map(games.map(({ id }, position) => [id, position])),
    positionByFeatureId: new Map(rows.features.map(({ id }, position) => [id, position])),
    vectorOf,
    stylesOf,
  };
}
