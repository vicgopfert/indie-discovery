import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const igdbEntity = z.object({ igdbId: z.number().int(), name: z.string().min(1) });
const majorCompany = igdbEntity.extend({
  via: z.enum(['platform', 'aaa_budget', 'conglomerate']),
  note: z.string().min(1).optional(),
});

const hasUniqueIds = (entries: { igdbId: number }[]) =>
  new Set(entries.map((e) => e.igdbId)).size === entries.length;
const publicSource = z.url({ protocol: /^https?$/ });

const override = igdbEntity.extend({
  reason: z.string().min(1),
  source: publicSource,
  decidedAt: z.iso.date(),
});

const controlledStudio = igdbEntity.extend({
  ownerIgdbId: z.number().int(),
  control: z.enum(['wholly_owned', 'majority', 'acquired']),
  acquiredAt: z.iso.date(),
  divestedAt: z.iso.date().optional(),
  source: publicSource,
  note: z.string().min(1),
});

const reviewedCompany = igdbEntity
  .extend({
    decision: z.enum([
      'no_current_effect',
      'wrong_igdb_parent',
      'wrong_credit',
      'rejected',
      'not_ownership',
      'pending_source',
    ]),
    decidedAt: z.iso.date(),
    group: z.string().min(1).optional(),
    acquiredYear: z.number().int().optional(),
    note: z.string().min(1).optional(),
  })
  .refine((c) => c.decision !== 'no_current_effect' || (c.group && c.acquiredYear), {
    message: 'Estúdio sem efeito atual precisa do grupo e do ano da compra.',
  });

const reviewedGame = igdbEntity.extend({
  decidedAt: z.iso.date(),
  note: z.string().min(1),
});

export const indieCriteriaSchema = z
  .object({
    principle: z.string().min(1),
    indieGenre: igdbEntity,
    excludedThemes: z.array(igdbEntity),
    majorCompaniesRule: z.string().min(1),
    majorCompanies: z.array(majorCompany).refine(hasUniqueIds, {
      message: 'Empresa repetida na lista de grandes.',
    }),
    controlledStudiosPolicy: z.object({
      control: z.string().min(1),
      coDevelopment: z.string().min(1),
      evidence: z.string().min(1),
      controlValues: z.string().min(1),
    }),
    controlledStudios: z.array(controlledStudio).refine(hasUniqueIds, {
      message: 'Estúdio repetido na lista de controlados.',
    }),
    completeEntry: z.object({ minSummaryLength: z.number().int().nonnegative() }),
    interestSignals: z.object({
      ratingsOnlyBefore: z.coerce.date(),
      postLaunchGraceDays: z.number().int().nonnegative(),
      postLaunchGraceRationale: z.string().min(1),
    }),
    reviewedCompaniesPolicy: z.string().min(1),
    reviewedCompanies: z.array(reviewedCompany).refine(hasUniqueIds, {
      message: 'Empresa repetida na lista de empresas revisadas.',
    }),
    noDeveloperReview: z.object({
      minRatings: z.number().int().positive(),
      rationale: z.string().min(1),
      reviewedGames: z.array(reviewedGame).refine(hasUniqueIds, {
        message: 'Jogo repetido na lista de jogos sem desenvolvedora revisados.',
      }),
    }),
    overridesPolicy: z.object({
      purpose: z.string().min(1),
      alwaysInclude: z.string().min(1),
      alwaysExclude: z.string().min(1),
      sourceRequired: z.string().min(1),
      maxEntries: z.number().int().positive(),
      maxEntriesReason: z.string().min(1),
    }),
    overrides: z.object({ alwaysInclude: z.array(override), alwaysExclude: z.array(override) }),
  })
  .refine(
    ({ overrides, overridesPolicy }) =>
      overrides.alwaysInclude.length + overrides.alwaysExclude.length <= overridesPolicy.maxEntries,
    {
      message: 'As listas de exceção passaram do teto: o problema é a regra, não os casos.',
      path: ['overrides'],
    },
  )
  .refine(
    ({ controlledStudios, majorCompanies }) =>
      controlledStudios.every((s) => majorCompanies.some((m) => m.igdbId === s.ownerIgdbId)),
    {
      message: 'Todo estúdio controlado precisa ter como dona uma empresa da lista de grandes.',
      path: ['controlledStudios'],
    },
  )
  .refine(
    ({ controlledStudios }) =>
      controlledStudios.every((s) => !s.divestedAt || s.divestedAt > s.acquiredAt),
    { message: 'A saída do grupo precisa ser posterior à aquisição.', path: ['controlledStudios'] },
  )
  .refine(
    ({ reviewedCompanies, majorCompanies, controlledStudios }) =>
      reviewedCompanies.every(
        (c) =>
          !majorCompanies.some((m) => m.igdbId === c.igdbId) &&
          !controlledStudios.some((s) => s.igdbId === c.igdbId),
      ),
    {
      message: 'Empresa revisada não pode estar também na lista de grandes ou de controlados.',
      path: ['reviewedCompanies'],
    },
  );

export type IndieCriteria = z.infer<typeof indieCriteriaSchema>;

export const INDIE_CRITERIA_FILE = resolve(process.cwd(), 'config/indie-criteria.json');

export interface VersionedIndieCriteria {
  criteria: IndieCriteria;
  version: string;
}

export function readIndieCriteria(file = INDIE_CRITERIA_FILE): IndieCriteria {
  return readVersionedIndieCriteria(file).criteria;
}

// A versão é o hash do arquivo: separa "o jogo mudou" de "a regra mudou" entre execuções.
export function readVersionedIndieCriteria(file = INDIE_CRITERIA_FILE): VersionedIndieCriteria {
  const content = readFileSync(file, 'utf8');
  return {
    criteria: indieCriteriaSchema.parse(JSON.parse(content)),
    version: createHash('sha256').update(content).digest('hex'),
  };
}
