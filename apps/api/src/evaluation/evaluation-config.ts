import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { DiscoveryMode } from '../generated/prisma/client';

export const EVALUATION_CONFIG_FILE = resolve(process.cwd(), 'config/evaluation.json');

const size = z.number().int().positive();
const score = z.number().int().min(1).max(5);
const ratio = z.number().gt(0).lte(1);
const rationale = z.string().min(1);
const ratedSlugs = z.array(z.tuple([z.string().min(1), score])).min(1);

export const evaluationConfigSchema = z.object({
  seed: z.number().int().nonnegative(),
  seedRationale: rationale,
  cutoffs: z.array(size).min(1),
  cutoffsRationale: rationale,
  samplingsRationale: rationale,
  attributeProfiles: z.object({
    profilesPerType: size,
    minGames: size,
    positiveScores: z.array(score.min(4)).min(1),
    negativeScores: z.array(score.max(2)),
    rationale,
  }),
  coherentProfiles: z.object({
    count: size,
    maxDocumentRatio: ratio,
    minGames: size,
    mainScores: z.array(score.min(4)).min(2),
    secondScores: z.array(score.min(4)).min(2),
    rationale,
  }),
  coldStartProfiles: z.object({
    count: size,
    preferences: size,
    ratedScores: z.array(score.min(4)).min(1),
    aboveDocumentRatio: ratio,
    aboveEvery: size,
    rationale,
  }),
  bootstrap: z.object({
    seed: z.number().int().nonnegative(),
    resamples: size,
    confidence: z.number().gt(0).lt(1),
    rationale,
  }),
  cases: z.object({
    regression: z.object({
      primaryGenre: z.string().min(1),
      primaryTheme: z.string().min(1),
      primaryCount: size,
      secondary: z.array(z.string().min(1)).min(2),
      secondaryPattern: z.string().min(1),
    }),
    realistic: z.record(z.string().min(1), ratedSlugs),
    realisticOnlyRecord: z.array(z.string().min(1)),
    rationale,
  }),
  criteria: z.object({
    coherentMain: ratio,
    coherentSecond: ratio,
    coherentNone: ratio,
    minShelves: size,
    coherentProfiles: size,
    rationale,
  }),
  variants: z.object({
    shelfLimit: z.array(ratio).min(1),
    blockShares: z.array(z.object({ GENRE: ratio, THEME: ratio, TAG: ratio })).min(1),
    discoveryLambda: z.array(z.number().positive()).min(1),
    popularLambda: z.array(z.number().negative()).min(1),
    preferenceWeight: z.array(z.number().positive()).min(1),
    rationale,
  }),
  rules: z.object({
    blockShares: z.object({
      mode: z.enum(DiscoveryMode),
      cutoff: size,
      minDifference: z.number().nonnegative(),
      rationale,
    }),
    lambda: z.object({
      cutoff: size,
      minArpGap: z.number().nonnegative(),
      maxLowKnown: ratio,
      minHitRatio: z.number().positive(),
      coverageSubsample: ratio,
      coverageRationale: rationale,
      rationale,
      fallbackRationale: rationale,
      pairRationale: rationale,
    }),
    preferenceWeight: z.object({
      mode: z.enum(DiscoveryMode),
      cutoff: size,
      minPreferenceCoverage: ratio,
      rationale,
    }),
    upcomingDominance: ratio,
    upcomingRationale: rationale,
    rationale,
  }),
});

export type EvaluationConfig = z.infer<typeof evaluationConfigSchema>;

export function readEvaluationConfig(file = EVALUATION_CONFIG_FILE): EvaluationConfig {
  return evaluationConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
