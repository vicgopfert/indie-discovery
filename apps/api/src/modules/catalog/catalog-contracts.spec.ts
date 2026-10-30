import { FeatureQuerySchema, GameDetailSchema, GameSearchQuerySchema } from '@indie/contracts';

const messages = (input: unknown) => {
  const result = GameSearchQuerySchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('GameSearchQuerySchema', () => {
  it('sem parâmetros, usa a primeira página de 24 jogos mais populares', () => {
    expect(GameSearchQuerySchema.parse({})).toEqual({
      genre: [],
      theme: [],
      country: [],
      sort: 'popular',
      page: 1,
      pageSize: 24,
    });
  });

  it('aceita filtro com um valor ou repetido, sem duplicar', () => {
    expect(
      GameSearchQuerySchema.parse({ genre: 'puzzle', theme: ['horror', ' horror '] }),
    ).toMatchObject({ genre: ['puzzle'], theme: ['horror'] });
  });

  it('aceita a sigla do país em minúsculas e o país não informado', () => {
    expect(GameSearchQuerySchema.parse({ country: ['br', ' PT ', 'Unknown', 'BR'] })).toMatchObject(
      { country: ['BR', 'PT', 'unknown'] },
    );
  });

  it('aceita os três valores do filtro de português', () => {
    for (const portuguese of ['yes', 'no', 'unknown']) {
      expect(GameSearchQuerySchema.parse({ portuguese }).portuguese).toBe(portuguese);
    }
  });

  it('converte página e tamanho vindos da URL como texto', () => {
    expect(GameSearchQuerySchema.parse({ page: '3', pageSize: '48' })).toMatchObject({
      page: 3,
      pageSize: 48,
    });
  });

  it('busca em branco é o mesmo que nenhuma busca', () => {
    expect(GameSearchQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it.each([
    [{ pageSize: '49' }, 'O tamanho da página vai até 48.'],
    [{ pageSize: '0' }, 'O tamanho da página começa em 1.'],
    [{ page: '1001' }, 'A página vai até 1000.'],
    [{ page: 'dois' }, 'A página deve ser um número.'],
    [{ page: '1.5' }, 'A página deve ser um número inteiro.'],
    [{ genre: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'Até 5 valores por filtro.'],
    [{ genre: '' }, 'Filtro vazio.'],
    [{ status: 'cancelado' }, 'Situação deve ser released ou upcoming.'],
    [{ sort: 'random' }, 'Ordenação deve ser popular, newest ou name.'],
    [{ q: 'x'.repeat(101) }, 'A busca tem no máximo 100 caracteres.'],
    [{ q: ['a', 'b'] }, 'Informe a busca uma vez só.'],
    [{ country: 'BRA' }, 'País deve ser a sigla de duas letras ou unknown.'],
    [{ country: ['AR', 'BR', 'CL', 'PT', 'UY', 'PY'] }, 'Até 5 valores por filtro.'],
    [{ portuguese: 'sim' }, 'Português deve ser yes, no ou unknown.'],
  ])('recusa %j', (input, message) => {
    expect(messages(input)).toEqual([message]);
  });
});

describe('FeatureQuerySchema', () => {
  it('aceita gênero e tema', () => {
    expect(FeatureQuerySchema.parse({ type: 'genre' })).toEqual({ type: 'genre' });
    expect(FeatureQuerySchema.parse({ type: 'theme' })).toEqual({ type: 'theme' });
  });

  it('não expõe palavras-chave', () => {
    expect(FeatureQuerySchema.safeParse({ type: 'keyword' }).success).toBe(false);
  });
});

describe('GameDetailSchema', () => {
  const detail = {
    slug: 'celeste',
    name: 'Celeste',
    coverImageId: 'co3byy',
    releaseStatus: 'RELEASED',
    firstReleaseDate: '2018-01-25',
    genres: [{ slug: 'platform', name: 'Plataforma' }],
    summary: 'Ajude Madeline a escalar a montanha.',
    themes: [{ slug: 'action', name: 'Ação' }],
    developers: ['Maddy Makes Games'],
    publishers: ['Maddy Makes Games'],
    studioCountry: { code: 'CA', name: 'Canadá', source: 'IGDB' },
    languages: [
      {
        locale: 'pt-BR',
        name: 'Português (Brasil)',
        interface: true,
        subtitles: true,
        audio: false,
      },
    ],
    officialUrl: 'https://www.celestegame.com',
  };

  it('aceita a ficha completa e a ficha sem os dados opcionais', () => {
    expect(GameDetailSchema.safeParse(detail).success).toBe(true);
    expect(
      GameDetailSchema.safeParse({
        ...detail,
        firstReleaseDate: null,
        developers: [],
        publishers: [],
        studioCountry: null,
        languages: [],
        officialUrl: null,
      }).success,
    ).toBe(true);
  });

  it('só aceita link http ou https', () => {
    expect(
      GameDetailSchema.safeParse({ ...detail, officialUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });
});
