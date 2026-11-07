import {
  evidenceAgreement,
  fallbackMatcher,
  relevantTags,
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
  tags: [
    tag(1716, 'Roguelike', { keywords: ['roguelike', 'roguelite'], summaryTerms: ['roguelike'] }),
    tag(1628, 'Metroidvania', { keywords: ['metroidvania'], summaryTerms: ['metroidvania'] }),
    tag(492, 'Indie', { group: 'other', accepted: false, keywords: ['indie'] }),
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
    const valid = (tags: TagVocabulary['tags']) =>
      tagVocabularySchema.safeParse({ rule: 'x', tags }).success;

    expect(valid(vocabulary.tags)).toBe(true);
    expect(valid([tag(1, 'A', { keywords: ['x'] }), tag(2, 'B', { keywords: ['X'] })])).toBe(false);
    expect(valid([tag(1, 'A'), tag(1, 'B')])).toBe(false);
  });
});
