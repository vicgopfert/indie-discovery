import { LIST_TYPES, ListTypeSchema, RatingScoreSchema } from '@indie/contracts';
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
