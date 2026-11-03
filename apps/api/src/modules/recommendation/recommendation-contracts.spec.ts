import { RecommendationListSchema, RecommendationQuerySchema } from '@indie/contracts';

const messages = (input: unknown) => {
  const result = RecommendationQuerySchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('RecommendationQuerySchema', () => {
  it('sem parâmetros, pede 20 jogos no modo salvo do usuário', () => {
    expect(RecommendationQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('aceita o modo em minúsculas e devolve o valor do banco', () => {
    expect(RecommendationQuerySchema.parse({ mode: 'popular' }).mode).toBe('POPULAR');
    expect(RecommendationQuerySchema.parse({ mode: 'balanced' }).mode).toBe('BALANCED');
    expect(RecommendationQuerySchema.parse({ mode: 'discovery' }).mode).toBe('DISCOVERY');
  });

  it('converte o limite vindo da URL como texto', () => {
    expect(RecommendationQuerySchema.parse({ limit: '50' }).limit).toBe(50);
  });

  it.each([
    [{ mode: 'DISCOVERY' }, 'Modo deve ser popular, balanced ou discovery.'],
    [{ mode: 'novidades' }, 'Modo deve ser popular, balanced ou discovery.'],
    [{ limit: '51' }, 'O limite vai até 50.'],
    [{ limit: '0' }, 'O limite começa em 1.'],
    [{ limit: 'vinte' }, 'O limite deve ser um número.'],
    [{ limit: '2.5' }, 'O limite deve ser um número inteiro.'],
  ])('recusa %j', (input, message) => {
    expect(messages(input)).toEqual([message]);
  });
});

describe('RecommendationListSchema', () => {
  const game = {
    slug: 'spelunky',
    name: 'Spelunky',
    coverImageId: 'co1abc',
    releaseStatus: 'RELEASED',
    firstReleaseDate: '2013-07-03',
    genres: [{ slug: 'platform', name: 'Plataforma' }],
  };

  it('aceita os dois tipos de motivo e o item sem motivo', () => {
    const list = {
      mode: 'DISCOVERY',
      basis: 'profile',
      items: [
        {
          game,
          reason: { kind: 'features', features: [{ slug: 'platform', name: 'Plataforma' }] },
          lowKnown: true,
        },
        {
          game,
          reason: {
            kind: 'liked-game',
            game: { slug: 'celeste', name: 'Celeste', inCatalog: false },
          },
          lowKnown: false,
        },
        { game, reason: null, lowKnown: false },
      ],
    };

    expect(RecommendationListSchema.safeParse(list).success).toBe(true);
  });

  it('recusa motivo sem atributos ou com mais de três', () => {
    const withFeatures = (count: number) => ({
      mode: 'BALANCED',
      basis: 'profile',
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
    });

    expect(RecommendationListSchema.safeParse(withFeatures(0)).success).toBe(false);
    expect(RecommendationListSchema.safeParse(withFeatures(4)).success).toBe(false);
  });
});
