import { z } from 'zod';

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const RatingScoreSchema = z
  .number({ error: 'A nota deve ser um número.' })
  .int({ error: 'A nota deve ser um número inteiro.' })
  .min(RATING_MIN, { error: `A nota vai de ${RATING_MIN} a ${RATING_MAX}.` })
  .max(RATING_MAX, { error: `A nota vai de ${RATING_MIN} a ${RATING_MAX}.` });

export const LIST_TYPES = ['FAVORITE', 'COMPLETED', 'WANT_TO_PLAY'] as const;

export const ListTypeSchema = z.enum(LIST_TYPES, {
  error: 'Lista deve ser FAVORITE, COMPLETED ou WANT_TO_PLAY.',
});

export type ListType = z.infer<typeof ListTypeSchema>;
