import { FeatureQuerySchema, GameSearchQuerySchema } from '@indie/contracts';

const messages = (input: unknown) => {
  const result = GameSearchQuerySchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('GameSearchQuerySchema', () => {
  it('sem parâmetros, usa a primeira página de 24 jogos mais populares', () => {
    expect(GameSearchQuerySchema.parse({})).toEqual({
      genre: [],
      theme: [],
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
