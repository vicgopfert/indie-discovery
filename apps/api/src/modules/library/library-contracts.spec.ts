import {
  LIST_TYPES,
  ListParamSchema,
  ListTypeSchema,
  PreferencesInputSchema,
  RatingInputSchema,
  RatingScoreSchema,
} from '@indie/contracts';
import { ListType } from '../../generated/prisma/client';

describe('RatingScoreSchema', () => {
  it('aceita notas inteiras de 1 a 5', () => {
    for (const score of [1, 2, 3, 4, 5]) {
      expect(RatingScoreSchema.parse(score)).toBe(score);
    }
  });

  it.each([
    [0, 'A nota vai de 1 a 5.'],
    [6, 'A nota vai de 1 a 5.'],
    [3.5, 'A nota deve ser um número inteiro.'],
    ['4', 'A nota deve ser um número.'],
  ])('recusa %p', (score, message) => {
    const result = RatingScoreSchema.safeParse(score);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([message]);
  });
});

describe('ListTypeSchema', () => {
  it('tem as mesmas listas do banco', () => {
    expect([...LIST_TYPES].sort()).toEqual(Object.values(ListType).sort());
  });

  it('recusa uma lista desconhecida', () => {
    expect(ListTypeSchema.safeParse('WISHLIST').error?.issues[0]?.message).toBe(
      'Lista deve ser FAVORITE, COMPLETED ou WANT_TO_PLAY.',
    );
  });
});

describe('ListParamSchema', () => {
  it('converte a lista da URL no valor do banco', () => {
    expect(
      ['favorite', 'completed', 'want-to-play'].map((list) => ListParamSchema.parse(list)),
    ).toEqual(['FAVORITE', 'COMPLETED', 'WANT_TO_PLAY']);
  });

  it('recusa o valor do banco e listas desconhecidas na URL', () => {
    for (const list of ['FAVORITE', 'want_to_play', 'wishlist']) {
      expect(ListParamSchema.safeParse(list).error?.issues[0]?.message).toBe(
        'Lista deve ser favorite, completed ou want-to-play.',
      );
    }
  });
});

describe('PreferencesInputSchema', () => {
  const messages = (input: unknown) =>
    PreferencesInputSchema.safeParse(input).error?.issues.map((issue) => issue.message) ?? [];

  it('aceita gêneros e temas somando pelo menos 3, sem repetir', () => {
    expect(
      PreferencesInputSchema.parse({
        genres: ['puzzle', ' puzzle ', 'platform'],
        themes: ['horror'],
      }),
    ).toEqual({ genres: ['puzzle', 'platform'], themes: ['horror'] });
  });

  it('aceita só gêneros ou só temas', () => {
    expect(PreferencesInputSchema.parse({ themes: ['horror', 'fantasy', 'comedy'] })).toEqual({
      genres: [],
      themes: ['horror', 'fantasy', 'comedy'],
    });
  });

  it('recusa menos de 3 no total, contando repetidos uma vez', () => {
    expect(messages({ genres: ['puzzle', 'puzzle'], themes: ['horror'] })).toEqual([
      'Escolha pelo menos 3 gêneros ou temas.',
    ]);
  });

  it('recusa mais de 50 de um tipo e slug vazio', () => {
    expect(messages({ genres: Array.from({ length: 51 }, (_, i) => `g${i}`) })).toContain(
      'Até 50 gêneros.',
    );
    expect(messages({ genres: ['puzzle', ' ', 'platform'] })).toContain('Slug vazio.');
  });
});

describe('RatingInputSchema', () => {
  it('exige a nota', () => {
    expect(RatingInputSchema.safeParse({}).error?.issues[0]?.message).toBe(
      'A nota deve ser um número.',
    );
  });
});
