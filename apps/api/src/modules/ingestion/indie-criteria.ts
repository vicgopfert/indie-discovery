import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { FeatureType, ReleaseStatus } from '../../generated/prisma/client';
import type { MappedGame } from './igdb.mapper';

const igdbEntity = z.object({ igdbId: z.number().int(), name: z.string().min(1) });
const override = igdbEntity.extend({
  reason: z.string().min(1),
  source: z.url({ protocol: /^https?$/ }),
  decidedAt: z.iso.date(),
});

export const indieCriteriaSchema = z
  .object({
    principle: z.string().min(1),
    indieGenre: igdbEntity,
    excludedThemes: z.array(igdbEntity),
    excludedPublishersRule: z.string().min(1),
    excludedPublishers: z.array(igdbEntity),
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
  );

export type IndieCriteria = z.infer<typeof indieCriteriaSchema>;

export const INDIE_CRITERIA_FILE = resolve(process.cwd(), 'config/indie-criteria.json');

export function readIndieCriteria(file = INDIE_CRITERIA_FILE): IndieCriteria {
  return indieCriteriaSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export type RejectionReason =
  | 'MANUALLY_EXCLUDED'
  | 'NOT_INDIE'
  | 'MAJOR_PUBLISHER'
  | 'EXCLUDED_THEME'
  | 'CANCELLED'
  | 'INCOMPLETE_ENTRY'
  | 'NO_INTEREST_SIGNAL';

export type CriteriaVerdict = { accepted: true } | { accepted: false; reason: RejectionReason };

// As listas de exceção corrigem só a classificação indie (gênero e publisher); nunca
// sobrepõem o filtro de conteúdo, a qualidade da ficha ou o sinal de interesse.
export function evaluateIndieCriteria(game: MappedGame, criteria: IndieCriteria): CriteriaVerdict {
  const has = (list: { igdbId: number }[], igdbId: number) =>
    list.some((entry) => entry.igdbId === igdbId);

  if (has(criteria.overrides.alwaysExclude, game.igdbId)) return reject('MANUALLY_EXCLUDED');
  if (!has(criteria.overrides.alwaysInclude, game.igdbId)) {
    if (!hasFeature(game, FeatureType.GENRE, criteria.indieGenre.igdbId)) {
      return reject('NOT_INDIE');
    }
    if (game.companies.some((c) => c.isPublisher && has(criteria.excludedPublishers, c.igdbId))) {
      return reject('MAJOR_PUBLISHER');
    }
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

function reject(reason: RejectionReason): CriteriaVerdict {
  return { accepted: false, reason };
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
