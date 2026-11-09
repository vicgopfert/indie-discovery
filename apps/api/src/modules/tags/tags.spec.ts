import { FeatureType, TagSource } from '../../generated/prisma/client';
import {
  evidenceAgreement,
  fallbackMatcher,
  relevantTags,
  tagAssigner,
  tagFeatures,
  type TagVocabulary,
  tagVocabularySchema,
} from './tags';

const tag = (
  id: number,
  name: string,
  overrides: Partial<TagVocabulary['tags'][number]> = {},
): TagVocabulary['tags'][number] => ({
  id,
  name,
  englishName: name,
  group: 'subgenre',
  accepted: true,
  shelf: true,
  catalogGames: 10,
  styles: [],
  keywords: [],
  summaryTerms: [],
  ...overrides,
});

const vocabulary: TagVocabulary = {
  rule: 'teste',
  minRelativeWeight: 0.3,
  minRelativeWeightRationale: 'teste',
  tags: [
    tag(1716, 'Roguelike', { keywords: ['roguelike', 'roguelite'], summaryTerms: ['roguelike'] }),
    tag(1628, 'Metroidvania', { keywords: ['metroidvania'], summaryTerms: ['metroidvania'] }),
    tag(492, 'Indie', { group: 'other', accepted: false, keywords: ['indie'] }),
    tag(4106, 'RPG de Ação', { englishName: 'Action RPG', group: 'subgenre' }),
  ],
};

describe('relevantTags', () => {
  it('mantém as etiquetas com peso relativo ao menos o mínimo, da mais votada para a menos', () => {
    const tags = [
      { tagid: 3, weight: 50 },
      { tagid: 1, weight: 1000 },
      { tagid: 2, weight: 99 },
    ];

    expect(relevantTags(tags, 0.1)).toEqual([{ tagid: 1, weight: 1000, relative: 1 }]);
    expect(relevantTags(tags, 0.05).map((t) => [t.tagid, t.relative])).toEqual([
      [1, 1],
      [2, 0.099],
      [3, 0.05],
    ]);
  });

  it('o corte é do próprio jogo: um jogo pequeno mantém as etiquetas com poucos votos', () => {
    expect(
      relevantTags(
        [
          { tagid: 1, weight: 12 },
          { tagid: 2, weight: 4 },
        ],
        0.3,
      ),
    ).toHaveLength(2);
  });

  it('sem etiquetas ou sem votos, não há etiquetas relevantes', () => {
    expect(relevantTags([], 0.1)).toEqual([]);
    expect(relevantTags([{ tagid: 1, weight: 0 }], 0.1)).toEqual([]);
  });
});

describe('fallbackMatcher', () => {
  const match = fallbackMatcher(vocabulary);

  it('casa as palavras-chave pelo slug e os termos do resumo como palavra inteira', () => {
    expect(
      match({
        keywords: ['Roguelite', 'pixel-art'],
        summary: 'A metroidvania with roguelike runs.',
      }),
    ).toMatchObject([
      { tagid: 1716, source: 'keyword', term: 'Roguelite' },
      { tagid: 1716, source: 'summary', term: 'roguelike' },
      { tagid: 1628, source: 'summary', term: 'metroidvania' },
    ]);
    expect(match({ keywords: [], summary: 'Metroidvanias everywhere' })).toEqual([]);
  });

  it('ignora as etiquetas fora do vocabulário aceito', () => {
    expect(match({ keywords: ['indie'], summary: '' })).toEqual([]);
  });
});

describe('evidenceAgreement', () => {
  it('mede, nos jogos com as duas fontes, quantas vezes a Steam confirma a etiqueta', () => {
    const keyword = (term: string) => ({ tagid: 1716, source: 'keyword' as const, term });
    const rows = evidenceAgreement([
      { matches: [keyword('roguelike')], steamTags: new Set([1716]) },
      { matches: [keyword('roguelike')], steamTags: new Set([1716]) },
      { matches: [keyword('shop-keeper')], steamTags: new Set([19]) },
      { matches: [keyword('shop-keeper')], steamTags: new Set([1716]) },
    ]);

    expect(rows).toEqual([
      { term: 'keyword:shop-keeper', tagid: 1716, games: 2, confirmed: 1 },
      { term: 'keyword:roguelike', tagid: 1716, games: 2, confirmed: 2 },
    ]);
  });
});

describe('tagVocabularySchema', () => {
  it('recusa uma palavra-chave em duas etiquetas e uma etiqueta repetida', () => {
    expect(valid(vocabulary.tags)).toBe(true);
    expect(valid([tag(1, 'A', { keywords: ['x'] }), tag(2, 'B', { keywords: ['X'] })])).toBe(false);
    expect(valid([tag(1, 'A'), tag(1, 'B')])).toBe(false);
  });

  it('recusa duas etiquetas aceitas com o mesmo slug, que o filtro não distinguiria', () => {
    expect(valid([tag(1, 'Pixel Art'), tag(2, 'Pixel-art')])).toBe(false);
    expect(valid([tag(1, 'Pixel Art'), tag(2, 'Pixel-art', { accepted: false })])).toBe(true);
  });

  it('a mesma ideia aponta para um gênero ou tema da IGDB, pela chave da prateleira', () => {
    expect(valid([tag(1, 'Romance Visual', { sameIdeaAs: 'genre:visual-novel' })])).toBe(true);
    expect(valid([tag(1, 'Terror', { sameIdeaAs: 'theme:horror' })])).toBe(true);
    expect(valid([tag(1, 'Romance Visual', { sameIdeaAs: 'Visual Novel' })])).toBe(false);
    expect(valid([tag(1, 'Roguelike', { sameIdeaAs: 'tag:roguelike' })])).toBe(false);
  });

  function valid(tags: TagVocabulary['tags']) {
    return tagVocabularySchema.safeParse({
      rule: 'x',
      minRelativeWeight: 0.3,
      minRelativeWeightRationale: 'x',
      tags,
    }).success;
  }
});

describe('tagAssigner', () => {
  const assign = tagAssigner(vocabulary);
  const steam = new Map([
    [
      100,
      [
        { tagid: 492, weight: 2000 },
        { tagid: 1716, weight: 1000 },
        { tagid: 4106, weight: 700 },
        { tagid: 1628, weight: 500 },
      ],
    ],
    [50, []],
  ]);
  const game = { appids: [100], keywords: ['metroidvania'], summary: 'A roguelike.' };

  it('fica com as aceitas da Steam no peso mínimo relativo, numeradas da mais votada', () => {
    // A mais votada (Indie) está fora do vocabulário, mas o peso relativo conta a partir dela.
    expect(assign(game, steam)).toEqual({
      steamAppId: 100,
      source: TagSource.STEAM,
      tags: [
        { tagid: 1716, rank: 1 },
        { tagid: 4106, rank: 2 },
      ],
    });
  });

  it('com mais de um id, vale o primeiro com etiquetas na ordem numérica', () => {
    expect(assign({ ...game, appids: [300, 100, 50] }, steam).steamAppId).toBe(100);
    expect(assign({ ...game, appids: [300, 200] }, steam).steamAppId).toBe(200);
  });

  it('sem etiqueta aceita da Steam, usa a reserva da IGDB, sem posição', () => {
    expect(assign({ ...game, appids: [50] }, steam)).toEqual({
      steamAppId: 50,
      source: TagSource.IGDB,
      tags: [
        { tagid: 1628, rank: null },
        { tagid: 1716, rank: null },
      ],
    });
    expect(assign({ appids: [], keywords: [], summary: '' }, steam)).toEqual({
      steamAppId: null,
      source: null,
      tags: [],
    });
  });
});

describe('tagFeatures', () => {
  it('vira atributo TAG com o nome em português e o slug pelo nome em inglês', () => {
    expect(
      tagFeatures(vocabulary)([
        { tagid: 4106, rank: 1 },
        { tagid: 492, rank: 2 },
      ]),
    ).toEqual([
      { type: FeatureType.TAG, igdbId: 4106, name: 'RPG de Ação', slug: 'action-rpg', rank: 1 },
    ]);
  });
});
