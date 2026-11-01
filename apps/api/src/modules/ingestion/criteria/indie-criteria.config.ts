import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const igdbEntity = z.object({ igdbId: z.number().int(), name: z.string().min(1) });
const majorCompany = igdbEntity.extend({
  via: z.enum(['platform', 'aaa_budget', 'conglomerate']),
  note: z.string().min(1).optional(),
});

export const hasUniqueIds = (entries: { igdbId: number }[]) =>
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
      wantToPlayMinCount: z.number().int().positive(),
      wantToPlayRationale: z.string().min(1),
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

// A versão é o hash do arquivo, que só tem o que decide o veredito: separa "o jogo mudou" de "a
// regra mudou" entre execuções. O que só alimenta os alertas fica em config/ingestion-review.json.
export function readVersionedIndieCriteria(file = INDIE_CRITERIA_FILE): VersionedIndieCriteria {
  const content = readFileSync(file, 'utf8');
  return {
    criteria: indieCriteriaSchema.parse(JSON.parse(content)),
    version: createHash('sha256').update(content).digest('hex'),
  };
}
