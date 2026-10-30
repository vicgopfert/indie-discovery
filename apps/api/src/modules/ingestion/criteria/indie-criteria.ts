import { FeatureType, ReleaseStatus } from '../../../generated/prisma/client';
import type { MappedCompany, MappedGame } from '../igdb/igdb.mapper';
import type { IndieCriteria } from './indie-criteria.config';

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

// O que a ingestão sabe do jogo além da ficha: se ele estava no catálogo na última execução
// bem-sucedida e quantas pessoas o marcaram como "Want to Play" (0 enquanto não foi buscado).
export interface EvaluationContext {
  wasInCatalog: boolean;
  wantToPlayCount?: number;
}

// As listas de exceção corrigem só a classificação indie (gênero e desenvolvedora); nunca
// sobrepõem o filtro de conteúdo, a qualidade da ficha ou o sinal de interesse.
export function evaluateIndieCriteria(
  game: MappedGame,
  criteria: IndieCriteria,
  now: Date,
  context: EvaluationContext = { wasInCatalog: false },
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
  if (!hasInterestSignal(game, criteria, now, context)) {
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

const DAY_MS = 86_400_000;

export function isWithinPostLaunchGrace(game: MappedGame, criteria: IndieCriteria, now: Date) {
  return (
    game.releaseStatus === ReleaseStatus.RELEASED &&
    game.firstReleaseDate !== null &&
    now.getTime() - game.firstReleaseDate.getTime() <
      criteria.interestSignals.postLaunchGraceDays * DAY_MS
  );
}

// Lançados antes do corte só contam com avaliações; a partir dele, avaliações ou hypes.
// Jogos por lançar entram com data marcada ou, sem data, com hypes. A carência pós-lançamento
// protege só a passagem de "por lançar" a lançado de quem já estava no catálogo: as avaliações
// levam tempo para aparecer, mas a carência não admite jogo que nunca entrou. O "Want to Play"
// com a contagem mínima vale em qualquer situação, somado aos outros sinais (B-61).
function hasInterestSignal(
  game: MappedGame,
  criteria: IndieCriteria,
  now: Date,
  { wasInCatalog, wantToPlayCount = 0 }: EvaluationContext,
) {
  if (wantToPlayCount >= criteria.interestSignals.wantToPlayMinCount) return true;
  if (
    game.releaseStatus === ReleaseStatus.UPCOMING ||
    (wasInCatalog && isWithinPostLaunchGrace(game, criteria, now))
  ) {
    return game.firstReleaseDate !== null || game.hypes > 0;
  }
  if (
    game.firstReleaseDate !== null &&
    game.firstReleaseDate < criteria.interestSignals.ratingsOnlyBefore
  ) {
    return game.ratingCount > 0;
  }
  return game.ratingCount > 0 || game.hypes > 0;
}
