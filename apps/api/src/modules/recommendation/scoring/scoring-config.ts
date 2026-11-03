import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { DiscoveryMode, ListType } from '../../../generated/prisma/client';
import { RECOMMENDATION_CONFIG_FILE } from '../tfidf';

const size = z.number().int().positive();

// As prateleiras são a fonte da lista principal: com o teto dela abaixo do delas, os prefixos
// das prateleiras sempre bastam para preenchê-la.
const listsConfigSchema = z
  .object({
    maxInterests: size,
    maxInterestsRationale: z.string().min(1),
    shelfMinItems: size,
    shelfMinItemsRationale: z.string().min(1),
    overviewMainSize: size,
    overviewShelfSize: size,
    overviewSizesRationale: z.string().min(1),
    pageSize: size,
    mainCap: size,
    shelfCap: size,
    pagingRationale: z.string().min(1),
  })
  .refine(({ mainCap, shelfCap }) => mainCap <= shelfCap, {
    error: 'O teto da lista principal não pode passar o das prateleiras.',
  })
  .refine(({ overviewMainSize, mainCap }) => overviewMainSize <= mainCap, {
    error: 'A visão geral não pode mostrar mais que o teto da lista principal.',
  })
  .refine(
    ({ shelfMinItems, overviewShelfSize, shelfCap }) =>
      shelfMinItems <= overviewShelfSize && overviewShelfSize <= shelfCap,
    { error: 'O mínimo por prateleira vai até o tamanho dela na visão geral, e este até o teto.' },
  );

export const scoringConfigSchema = z.object({
  listBonus: z.object({
    [ListType.FAVORITE]: z.number().nonnegative(),
    [ListType.COMPLETED]: z.number().nonnegative(),
    [ListType.WANT_TO_PLAY]: z.number().nonnegative(),
  }),
  listBonusRationale: z.string().min(1),
  preferenceWeight: z.number().nonnegative(),
  preferenceWeightRationale: z.string().min(1),
  popularityWeightByMode: z.object({
    [DiscoveryMode.POPULAR]: z.number(),
    [DiscoveryMode.BALANCED]: z.number(),
    [DiscoveryMode.DISCOVERY]: z.number(),
  }),
  popularityWeightRationale: z.string().min(1),
  lists: listsConfigSchema,
});

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export type ListsConfig = ScoringConfig['lists'];

export function readScoringConfig(file = RECOMMENDATION_CONFIG_FILE): ScoringConfig {
  const { scoring } = z
    .object({ scoring: scoringConfigSchema })
    .parse(JSON.parse(readFileSync(file, 'utf8')));
  return scoring;
}
