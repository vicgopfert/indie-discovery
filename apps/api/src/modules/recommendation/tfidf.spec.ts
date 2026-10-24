import { FeatureType } from '../../generated/prisma/client';
import type { MappedFeature } from '../ingestion/igdb/igdb.mapper';
import {
  computeIdf,
  excludedKeywordMatcher,
  type TfidfConfig,
  tfidfConfigSchema,
  type TfidfVector,
  readTfidfConfig,
  tfidfVector,
} from './tfidf';

type Feature = Pick<MappedFeature, 'type' | 'igdbId' | 'name'>;

const genre = (igdbId: number, name = `g${igdbId}`): Feature => ({
  type: FeatureType.GENRE,
  igdbId,
  name,
});
const theme = (igdbId: number, name = `t${igdbId}`): Feature => ({
  type: FeatureType.THEME,
  igdbId,
  name,
});
const keyword = (igdbId: number, name = `k${igdbId}`): Feature => ({
  type: FeatureType.KEYWORD,
  igdbId,
  name,
});

const config: TfidfConfig = {
  ...readTfidfConfig(),
  normalization: 'block',
  blockShares: { GENRE: 0.4, THEME: 0.3, KEYWORD: 0.3 },
  globalTypeWeights: { GENRE: 1, THEME: 1, KEYWORD: 0.5 },
  minDocumentFrequency: 2,
  maxDocumentRatio: 0.8,
};

// 5 jogos: o gênero 1 está em todos (indie), o 2 em 2, o tema 1 em 3, a palavra-chave 1 em 2
// e a 2 em 1 só.
const catalog: Feature[][] = [
  [genre(1), genre(2), theme(1), keyword(1)],
  [genre(1), genre(2), theme(1), keyword(1)],
  [genre(1), theme(1), keyword(2)],
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
    expect(idf.get('KEYWORD:1')).toBeCloseTo(Math.log(5 / 2));
  });

  it('conta cada atributo uma vez por jogo, mesmo repetido', () => {
    expect(idf.get('GENRE:3')).toBeCloseTo(Math.log(5 / 2));
  });

  it('descarta o atributo presente em quase todos os jogos', () => {
    expect(idf.has('GENRE:1')).toBe(false);
  });

  it('descarta o atributo presente em menos jogos que o mínimo', () => {
    expect(idf.has('KEYWORD:2')).toBe(false);
  });

  it('descarta palavras-chave da lista de excluídas, por nome ou padrão', () => {
    const withMetadata = [
      ...catalog,
      [keyword(90, 'steam achievements'), keyword(91, 'Digital Distribution')],
      [keyword(90, 'steam achievements'), keyword(91, 'Digital Distribution')],
    ];

    const result = computeIdf(withMetadata, config);

    expect(result.has('KEYWORD:90')).toBe(false);
    expect(result.has('KEYWORD:91')).toBe(false);
  });
});

describe('excludedKeywordMatcher', () => {
  const isExcluded = excludedKeywordMatcher(readTfidfConfig());

  it.each([
    'steam achievements',
    'steam',
    'steam next fest october 2026',
    'nextfest february 2026',
    'pax east 2016',
    'the game awards - best independent game - nominee',
    'crowdfunding - kickstarter',
    'xbox controller support for pc',
    'previously on - xbox gamepass',
    'igf awards',
    'digital distribution',
    'playable without timed input',
  ])('exclui a palavra-chave de metadado "%s"', (name) => {
    expect(isExcluded(keyword(1, name))).toBe(true);
  });

  it.each([
    'steampunk',
    'demons',
    'witches',
    'eldritch horror',
    'trading card game',
    'multiplayer fps',
    'kitchen',
  ])('mantém a palavra-chave de conteúdo "%s"', (name) => {
    expect(isExcluded(keyword(1, name))).toBe(false);
  });

  it('só se aplica a palavras-chave, não a gêneros e temas', () => {
    expect(isExcluded(genre(1, 'steam'))).toBe(false);
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
    expect(squaredNorm(vector, 'KEYWORD')).toBeCloseTo(0.3);
    expect(vector.presentBlocks).toEqual(['GENRE', 'THEME', 'KEYWORD']);
  });

  it('mantém a fatia de cada tipo, por mais etiquetas de outro tipo que o jogo tenha', () => {
    const manyKeywords = computeIdf(
      [...catalog, [keyword(2), keyword(3)], [keyword(3), keyword(4)], [keyword(4)]],
      config,
    );
    const vector = tfidfVector(
      [...complete, keyword(2), keyword(3), keyword(4)],
      manyKeywords,
      config,
    );

    expect(squaredNorm(vector, 'GENRE')).toBeCloseTo(0.4);
    expect(squaredNorm(vector, 'KEYWORD')).toBeCloseTo(0.3);
  });

  it('redistribui a fatia do tipo ausente entre os presentes, sem perder norma', () => {
    const withoutKeywords = tfidfVector([genre(2), theme(1)], idf, config);

    expect(withoutKeywords.presentBlocks).toEqual(['GENRE', 'THEME']);
    expect(squaredNorm(withoutKeywords)).toBeCloseTo(1);
    expect(squaredNorm(withoutKeywords, 'GENRE')).toBeCloseTo(0.4 / 0.7);
    expect(squaredNorm(withoutKeywords, 'THEME')).toBeCloseTo(0.3 / 0.7);
  });

  it('descarta antes de normalizar: etiquetas descartadas não mudam nenhum peso', () => {
    const clean = tfidfVector(complete, idf, config);
    const withDiscarded = tfidfVector(
      [...complete, genre(1), keyword(2), keyword(90, 'steam achievements')],
      idf,
      config,
    );

    expect(Object.fromEntries(withDiscarded.weights)).toEqual(Object.fromEntries(clean.weights));
  });

  it('fica vazio, sem blocos, quando nenhum atributo do jogo sobrevive', () => {
    expect(tfidfVector([genre(1), keyword(2)], idf, config)).toEqual({
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
    expect(vector.presentBlocks).toEqual(['GENRE', 'THEME', 'KEYWORD']);
  });

  it('aplica o peso do tipo ao IDF', () => {
    // GENRE:2 e KEYWORD:1 têm o mesmo IDF; a palavra-chave vale metade.
    expect(vector.weights.get('KEYWORD:1')! / vector.weights.get('GENRE:2')!).toBeCloseTo(0.5);
  });
});

describe('readTfidfConfig', () => {
  it('lê e valida o arquivo versionado', () => {
    expect(readTfidfConfig()).toMatchObject({
      normalization: 'block',
      blockShares: { GENRE: 0.4, THEME: 0.3, KEYWORD: 0.3 },
      minDocumentFrequency: 3,
      maxDocumentRatio: 0.8,
    });
  });

  it('recusa fatias que não somam 1', () => {
    expect(() =>
      tfidfConfigSchema.parse({ ...config, blockShares: { GENRE: 0.5, THEME: 0.3, KEYWORD: 0.3 } }),
    ).toThrow('somar 1');
  });
});
