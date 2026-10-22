import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { FeatureType, ReleaseStatus } from '../../generated/prisma/client';
import type { MappedCompany, MappedGame } from './igdb.mapper';

const igdbEntity = z.object({ igdbId: z.number().int(), name: z.string().min(1) });
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
    majorCompanies: z.array(igdbEntity),
    controlledStudiosPolicy: z.object({
      control: z.string().min(1),
      coDevelopment: z.string().min(1),
      evidence: z.string().min(1),
      controlValues: z.string().min(1),
    }),
    controlledStudios: z.array(controlledStudio),
    completeEntry: z.object({ minSummaryLength: z.number().int().nonnegative() }),
    interestSignals: z.object({ ratingsOnlyBefore: z.coerce.date() }),
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

export function readIndieCriteria(file = INDIE_CRITERIA_FILE): IndieCriteria {
  return indieCriteriaSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export type RejectionReason =
  | 'MANUALLY_EXCLUDED'
  | 'NOT_INDIE'
  | 'CONTROLLED_DEVELOPER'
  | 'EXCLUDED_THEME'
  | 'CANCELLED'
  | 'INCOMPLETE_ENTRY'
  | 'NO_INTEREST_SIGNAL';

// Data de referência do controle: a do lançamento ou, no jogo sem data, a da avaliação.
export interface ControlCause {
  developer: string;
  owner: string;
  referenceDate: string;
  referenceDateSource: 'RELEASE' | 'EVALUATION';
}

export type CriteriaVerdict =
  | { accepted: true }
  | { accepted: false; reason: Exclude<RejectionReason, 'CONTROLLED_DEVELOPER'> }
  | ({ accepted: false; reason: 'CONTROLLED_DEVELOPER' } & ControlCause);

// As listas de exceção corrigem só a classificação indie (gênero e desenvolvedora); nunca
// sobrepõem o filtro de conteúdo, a qualidade da ficha ou o sinal de interesse.
export function evaluateIndieCriteria(
  game: MappedGame,
  criteria: IndieCriteria,
  now: Date,
): CriteriaVerdict {
  const has = (list: { igdbId: number }[], igdbId: number) =>
    list.some((entry) => entry.igdbId === igdbId);

  if (has(criteria.overrides.alwaysExclude, game.igdbId)) return reject('MANUALLY_EXCLUDED');
  if (!has(criteria.overrides.alwaysInclude, game.igdbId)) {
    if (!hasFeature(game, FeatureType.GENRE, criteria.indieGenre.igdbId)) {
      return reject('NOT_INDIE');
    }
    const control = findControlledDeveloper(game, criteria, now);
    if (control) return { accepted: false, reason: 'CONTROLLED_DEVELOPER', ...control };
  }
  if (criteria.excludedThemes.some((theme) => hasFeature(game, FeatureType.THEME, theme.igdbId))) {
    return reject('EXCLUDED_THEME');
  }
  if (game.isCancelled) return reject('CANCELLED');
  if (!isCompleteEntry(game, criteria)) return reject('INCOMPLETE_ENTRY');
  if (!hasInterestSignal(game, criteria.interestSignals.ratingsOnlyBefore)) {
    return reject('NO_INTEREST_SIGNAL');
  }
  return { accepted: true };
}

function reject(reason: Exclude<RejectionReason, 'CONTROLLED_DEVELOPER'>): CriteriaVerdict {
  return { accepted: false, reason };
}

function findControlledDeveloper(
  game: MappedGame,
  criteria: IndieCriteria,
  now: Date,
): ControlCause | null {
  const reference = {
    referenceDate: (game.firstReleaseDate ?? now).toISOString().slice(0, 10),
    referenceDateSource: game.firstReleaseDate ? ('RELEASE' as const) : ('EVALUATION' as const),
  };
  const majorName = (igdbId: number) =>
    criteria.majorCompanies.find((m) => m.igdbId === igdbId)?.name;

  for (const developer of game.companies.filter((c: MappedCompany) => c.isDeveloper)) {
    const major = majorName(developer.igdbId);
    if (major) return { developer: developer.name, owner: major, ...reference };

    const studio = criteria.controlledStudios.find(
      (s) =>
        s.igdbId === developer.igdbId &&
        s.acquiredAt <= reference.referenceDate &&
        (s.divestedAt === undefined || reference.referenceDate < s.divestedAt),
    );
    if (studio) {
      return { developer: developer.name, owner: majorName(studio.ownerIgdbId)!, ...reference };
    }
  }
  return null;
}

function hasFeature(game: MappedGame, type: FeatureType, igdbId: number) {
  return game.features.some((f) => f.type === type && f.igdbId === igdbId);
}

function isCompleteEntry(game: MappedGame, criteria: IndieCriteria) {
  const describedBeyondIndie = game.features.some(
    (f) =>
      f.type === FeatureType.THEME ||
      (f.type === FeatureType.GENRE && f.igdbId !== criteria.indieGenre.igdbId),
  );
  return (
    game.coverImageId !== null &&
    (game.summary?.length ?? 0) >= criteria.completeEntry.minSummaryLength &&
    describedBeyondIndie
  );
}

// Lançados antes do corte só contam com avaliações; a partir dele, avaliações ou hypes.
// Jogos por lançar entram com data marcada ou, sem data, com hypes.
function hasInterestSignal(game: MappedGame, ratingsOnlyBefore: Date) {
  if (game.releaseStatus === ReleaseStatus.UPCOMING) {
    return game.firstReleaseDate !== null || game.hypes > 0;
  }
  if (game.firstReleaseDate !== null && game.firstReleaseDate < ratingsOnlyBefore) {
    return game.ratingCount > 0;
  }
  return game.ratingCount > 0 || game.hypes > 0;
}
