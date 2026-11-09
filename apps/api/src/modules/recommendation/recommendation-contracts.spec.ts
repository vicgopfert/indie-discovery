import {
  RecommendationOverviewSchema,
  RecommendationPageQuerySchema,
  RecommendationPageSchema,
  RecommendationQuerySchema,
} from '@indie/contracts';

const messages = (schema: typeof RecommendationPageQuerySchema, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('RecommendationQuerySchema', () => {
  it('sem parâmetros, usa o modo salvo do usuário', () => {
    expect(RecommendationQuerySchema.parse({})).toEqual({});
  });

  it('aceita o modo em minúsculas e devolve o valor do banco', () => {
    expect(RecommendationQuerySchema.parse({ mode: 'popular' }).mode).toBe('POPULAR');
    expect(RecommendationQuerySchema.parse({ mode: 'balanced' }).mode).toBe('BALANCED');
    expect(RecommendationQuerySchema.parse({ mode: 'discovery' }).mode).toBe('DISCOVERY');
  });

  it('não aceita mais o limite: os tamanhos vêm da configuração', () => {
    expect(RecommendationQuerySchema.parse({ limit: '50' })).toEqual({});
  });
});

describe('RecommendationPageQuerySchema', () => {
  it('começa na página 1 e converte a página vinda da URL como texto', () => {
    expect(RecommendationPageQuerySchema.parse({})).toEqual({ page: 1 });
    expect(RecommendationPageQuerySchema.parse({ page: '3', mode: 'discovery' })).toEqual({
      page: 3,
      mode: 'DISCOVERY',
    });
  });

  it.each([
    [{ mode: 'DISCOVERY' }, 'Modo deve ser popular, balanced ou discovery.'],
    [{ page: '0' }, 'A página começa em 1.'],
    [{ page: '1001' }, 'A página vai até 1000.'],
    [{ page: '2.5' }, 'A página deve ser um número inteiro.'],
  ])('recusa %j', (input, message) => {
    expect(messages(RecommendationPageQuerySchema, input)).toEqual([message]);
  });
});

describe('Respostas das recomendações', () => {
  const game = {
    slug: 'spelunky',
    name: 'Spelunky',
    coverImageId: 'co1abc',
    releaseStatus: 'RELEASED',
    firstReleaseDate: '2013-07-03',
    genres: [{ slug: 'platform', name: 'Plataforma' }],
  };
  const items = [
    {
      game,
      reason: { kind: 'features', features: [{ slug: 'platform', name: 'Plataforma' }] },
      lowKnown: true,
    },
    {
      game,
      reason: { kind: 'liked-game', game: { slug: 'celeste', name: 'Celeste', inCatalog: false } },
      lowKnown: false,
    },
    { game, reason: null, lowKnown: false },
  ];
  const horror = { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' };
  const celeste = { slug: 'celeste', name: 'Celeste', inCatalog: true };
  const overviewWith = (shelves: unknown[]) => ({
    mode: 'DISCOVERY',
    basis: 'profile',
    main: { items, hasMore: true },
    shelves,
  });

  it('a visão geral aceita os dois tipos de motivo, o item sem motivo e os três tipos de prateleira', () => {
    const overview = overviewWith([
      {
        key: 'game:celeste',
        kind: 'liked-game',
        feature: null,
        game: celeste,
        items,
        hasMore: true,
      },
      { key: 'theme:horror', kind: 'interest', feature: horror, items, hasMore: true },
      { key: 'upcoming', kind: 'upcoming', feature: null, items, hasMore: false },
    ]);

    expect(RecommendationOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it('a prateleira por jogo exige o jogo de origem e a chave game:<slug>', () => {
    const shelf = { key: 'game:celeste', kind: 'liked-game', feature: null, game: celeste };
    const valid = (changes: object) =>
      RecommendationOverviewSchema.safeParse(
        overviewWith([{ ...shelf, items, hasMore: false, ...changes }]),
      ).success;

    expect(valid({})).toBe(true);
    expect(valid({ game: null })).toBe(false);
    expect(valid({ key: 'celeste' })).toBe(false);
  });

  it('a prateleira de interesse exige o título', () => {
    const withoutTitle = { type: 'THEME', slug: 'horror', name: 'Terror' };
    const valid = (feature: object) =>
      RecommendationOverviewSchema.safeParse(
        overviewWith([{ key: 'theme:horror', kind: 'interest', feature, items, hasMore: false }]),
      ).success;

    expect(valid(horror)).toBe(true);
    expect(valid(withoutTitle)).toBe(false);
  });

  it('aceita a prateleira de uma etiqueta e recusa a de estilo, que saiu no B-78', () => {
    const tag = { type: 'TAG', slug: 'roguelike', name: 'Roguelike', title: 'roguelikes' };
    const valid = (key: string, feature: object) =>
      RecommendationOverviewSchema.safeParse(
        overviewWith([{ key, kind: 'interest', feature, items, hasMore: false }]),
      ).success;

    expect(valid('tag:roguelike', tag)).toBe(true);
    expect(valid('style:roguelike', { ...tag, type: 'STYLE' })).toBe(false);
  });

  it('recusa prateleira de interesse sem atributo ou com chave fora do formato', () => {
    const shelf = { key: 'theme:horror', kind: 'interest', feature: horror, items, hasMore: true };
    const valid = (changes: object) =>
      RecommendationOverviewSchema.safeParse(overviewWith([{ ...shelf, ...changes }])).success;

    expect(valid({ feature: null })).toBe(false);
    expect(valid({ key: 'horror' })).toBe(false);
    expect(valid({ feature: { ...horror, type: 'KEYWORD' } })).toBe(false);
  });

  it('recusa motivo sem atributos ou com mais de três', () => {
    const withFeatures = (count: number) =>
      RecommendationPageSchema.safeParse({
        mode: 'BALANCED',
        basis: 'profile',
        key: 'main',
        feature: null,
        game: null,
        page: 1,
        hasMore: false,
        items: [
          {
            game,
            reason: {
              kind: 'features',
              features: Array.from({ length: count }, (_, i) => ({ slug: `g${i}`, name: `G${i}` })),
            },
            lowKnown: false,
          },
        ],
      }).success;

    expect(withFeatures(1)).toBe(true);
    expect(withFeatures(0)).toBe(false);
    expect(withFeatures(4)).toBe(false);
  });

  it('a página do "ver mais" exige a base da lista, como a visão geral', () => {
    const page = {
      mode: 'BALANCED',
      key: 'main',
      feature: null,
      game: null,
      page: 1,
      items,
      hasMore: false,
    };
    const valid = (basis?: string) =>
      RecommendationPageSchema.safeParse({ ...page, basis }).success;

    expect(valid('popular')).toBe(true);
    expect(valid(undefined)).toBe(false);
    expect(valid('cold-start')).toBe(false);
  });
});
