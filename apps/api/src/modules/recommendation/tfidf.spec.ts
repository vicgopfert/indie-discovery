import { FeatureType } from '../../generated/prisma/client';
import {
  computeIdf,
  type TfidfConfig,
  tfidfConfigSchema,
  type ContentFeature,
  type TfidfVector,
  readTfidfConfig,
  tfidfVector,
} from './tfidf';

const genre = (igdbId: number, name = `g${igdbId}`): ContentFeature => ({
  type: FeatureType.GENRE,
  igdbId,
  name,
});
const theme = (igdbId: number, name = `t${igdbId}`): ContentFeature => ({
  type: FeatureType.THEME,
  igdbId,
  name,
});
const tag = (igdbId: number, name = `e${igdbId}`): ContentFeature => ({
  type: FeatureType.TAG,
  igdbId,
  name,
});
const keyword = (igdbId: number, name = `k${igdbId}`): ContentFeature => ({
  type: FeatureType.KEYWORD,
  igdbId,
  name,
});

const config: TfidfConfig = {
  ...readTfidfConfig(),
  normalization: 'block',
  blockShares: { GENRE: 0.4, THEME: 0.3, TAG: 0.3 },
  globalTypeWeights: { GENRE: 1, THEME: 1, TAG: 0.5 },
  minDocumentFrequency: 2,
  maxDocumentRatio: 0.8,
};

// 5 jogos: o gênero 1 está em todos (indie), o 2 em 2, o tema 1 em 3, a etiqueta 1 em 2 e a 2
// em 1 só.
const catalog: ContentFeature[][] = [
  [genre(1), genre(2), theme(1), tag(1)],
  [genre(1), genre(2), theme(1), tag(1)],
  [genre(1), theme(1), tag(2)],
  [genre(1), genre(3), genre(3)],
  [genre(1), genre(3)],
];

function squaredNorm(vector: TfidfVector, type?: FeatureType) {
  return [...vector.weights]
    .filter(([key]) => type === undefined || key.startsWith(`${type}:`))
    .reduce((sum, [, w]) => sum + w * w, 0);
}

describe('computeIdf', () => {
  const idf = computeIdf(catalog, config);

  it('calcula ln(N / df) para os atributos mantidos', () => {
    expect(idf.get('GENRE:2')).toBeCloseTo(Math.log(5 / 2));
    expect(idf.get('THEME:1')).toBeCloseTo(Math.log(5 / 3));
    expect(idf.get('TAG:1')).toBeCloseTo(Math.log(5 / 2));
  });

  it('conta cada atributo uma vez por jogo, mesmo repetido', () => {
    expect(idf.get('GENRE:3')).toBeCloseTo(Math.log(5 / 2));
  });

  it('descarta o atributo presente em quase todos os jogos', () => {
    expect(idf.has('GENRE:1')).toBe(false);
  });

  it('descarta o atributo presente em menos jogos que o mínimo', () => {
    expect(idf.has('TAG:2')).toBe(false);
  });

  it('ignora as palavras-chave, que não entram no vetor', () => {
    const withKeywords = computeIdf([...catalog, [keyword(1)], [keyword(1)]], config);

    expect(withKeywords.has('KEYWORD:1')).toBe(false);
  });
});

describe('tfidfVector', () => {
  const idf = computeIdf(catalog, config);
  const complete = catalog[0]!;

  it('tem norma 1', () => {
    expect(squaredNorm(tfidfVector(complete, idf, config))).toBeCloseTo(1);
  });

  it('dá a cada tipo a sua fatia do vetor', () => {
    const vector = tfidfVector(complete, idf, config);

    expect(squaredNorm(vector, 'GENRE')).toBeCloseTo(0.4);
    expect(squaredNorm(vector, 'THEME')).toBeCloseTo(0.3);
    expect(squaredNorm(vector, 'TAG')).toBeCloseTo(0.3);
    expect(vector.presentBlocks).toEqual(['GENRE', 'THEME', 'TAG']);
  });

  it('mantém a fatia de cada tipo, por mais atributos de outro tipo que o jogo tenha', () => {
    const manyTags = computeIdf([...catalog, [tag(2), tag(3)], [tag(3), tag(4)], [tag(4)]], config);
    const vector = tfidfVector([...complete, tag(2), tag(3), tag(4)], manyTags, config);

    expect(squaredNorm(vector, 'GENRE')).toBeCloseTo(0.4);
    expect(squaredNorm(vector, 'TAG')).toBeCloseTo(0.3);
  });

  it('redistribui a fatia do tipo ausente entre os presentes, sem perder norma', () => {
    const withoutTags = tfidfVector([genre(2), theme(1)], idf, config);

    expect(withoutTags.presentBlocks).toEqual(['GENRE', 'THEME']);
    expect(squaredNorm(withoutTags)).toBeCloseTo(1);
    expect(squaredNorm(withoutTags, 'GENRE')).toBeCloseTo(0.4 / 0.7);
    expect(squaredNorm(withoutTags, 'THEME')).toBeCloseTo(0.3 / 0.7);
  });

  it('descarta antes de normalizar: atributos descartados não mudam nenhum peso', () => {
    const clean = tfidfVector(complete, idf, config);
    const withDiscarded = tfidfVector([...complete, genre(1), tag(2), keyword(1)], idf, config);

    expect(Object.fromEntries(withDiscarded.weights)).toEqual(Object.fromEntries(clean.weights));
  });

  it('fica vazio, sem blocos, quando nenhum atributo do jogo sobrevive', () => {
    expect(tfidfVector([genre(1), tag(2)], idf, config)).toEqual({
      weights: new Map(),
      presentBlocks: [],
    });
  });

  it('é idempotente e não depende da ordem das etiquetas', () => {
    const forward = tfidfVector(complete, idf, config);
    const again = tfidfVector(complete, computeIdf(catalog, config), config);
    const reversed = tfidfVector([...complete].reverse(), idf, config);

    expect(Object.fromEntries(again.weights)).toEqual(Object.fromEntries(forward.weights));
    expect(Object.fromEntries(reversed.weights)).toEqual(Object.fromEntries(forward.weights));
  });
});

describe('tfidfVector no modo global', () => {
  const globalConfig: TfidfConfig = { ...config, normalization: 'global' };
  const idf = computeIdf(catalog, globalConfig);
  const vector = tfidfVector(catalog[0]!, idf, globalConfig);

  it('normaliza todos os atributos juntos, com norma 1', () => {
    expect(squaredNorm(vector)).toBeCloseTo(1);
    expect(vector.presentBlocks).toEqual(['GENRE', 'THEME', 'TAG']);
  });

  it('aplica o peso do tipo ao IDF', () => {
    // GENRE:2 e TAG:1 têm o mesmo IDF; a etiqueta vale metade.
    expect(vector.weights.get('TAG:1')! / vector.weights.get('GENRE:2')!).toBeCloseTo(0.5);
  });
});

describe('readTfidfConfig', () => {
  it('lê e valida o arquivo versionado', () => {
    expect(readTfidfConfig()).toMatchObject({
      normalization: 'block',
      blockShares: { GENRE: 0.4, THEME: 0.3, TAG: 0.3 },
      minDocumentFrequency: 3,
      maxDocumentRatio: 0.8,
    });
  });

  it('recusa fatias que não somam 1', () => {
    expect(() =>
      tfidfConfigSchema.parse({ ...config, blockShares: { GENRE: 0.5, THEME: 0.3, TAG: 0.3 } }),
    ).toThrow('somar 1');
  });
});
