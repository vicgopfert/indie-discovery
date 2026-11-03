import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { DiscoveryMode, ListType } from '../../../generated/prisma/client';
import { RECOMMENDATION_CONFIG_FILE } from '../tfidf';

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
});

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export function readScoringConfig(file = RECOMMENDATION_CONFIG_FILE): ScoringConfig {
  const { scoring } = z
    .object({ scoring: scoringConfigSchema })
    .parse(JSON.parse(readFileSync(file, 'utf8')));
  return scoring;
}
