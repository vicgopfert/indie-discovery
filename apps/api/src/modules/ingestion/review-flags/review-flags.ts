import { ReviewFlagKind } from '../../../generated/prisma/client';
import type { MappedGame } from '../igdb/igdb.mapper';
import {
  type CriteriaVerdict,
  type IndieCriteria,
  isWithinPostLaunchGrace,
} from '../criteria/indie-criteria';

export interface StoredGame {
  igdbId: number;
  name: string;
  inCatalog: boolean;
  firstReleaseDate: Date | null;
  criteriaVersion: string;
  evaluatedAt: Date;
}

export interface EvaluatedGame {
  game: MappedGame;
  verdict: CriteriaVerdict;
}

export interface IgdbCompanyNode {
  name: string;
  parentIgdbId: number | null;
}

export interface ReviewFlag {
  kind: ReviewFlagKind;
  igdbId: number;
  gameName: string;
  detail: Record<string, unknown>;
}

export interface ReviewFlagInput {
  evaluated: readonly EvaluatedGame[];
  stored: ReadonlyMap<number, StoredGame>;
  companies: ReadonlyMap<number, IgdbCompanyNode>;
  criteria: IndieCriteria;
  criteriaVersion: string;
  now: Date;
}

// Os alertas de empresa não dependem de histórico: disparam enquanto a empresa não for revisada
// (reviewedCompanies) ou, no estúdio sem efeito atual, quando o jogo é do ano da compra em diante.
// Os de transição comparam com o que estava gravado.
export function detectReviewFlags(input: ReviewFlagInput): ReviewFlag[] {
  return input.evaluated.flatMap((evaluated) => [
    ...transitionFlags(evaluated, input),
    ...(evaluated.verdict.accepted ? companyFlags(evaluated.game, input) : []),
  ]);
}

function transitionFlags({ game, verdict }: EvaluatedGame, input: ReviewFlagInput): ReviewFlag[] {
  const before = input.stored.get(game.igdbId);
  if (!before) return [];
  const flags: ReviewFlag[] = [];
  const flag = (kind: ReviewFlagKind, detail: Record<string, unknown>) =>
    flags.push({ kind, igdbId: game.igdbId, gameName: game.name, detail });

  if (before.firstReleaseDate === null && game.firstReleaseDate !== null) {
    flag(ReviewFlagKind.RELEASE_DATE_ASSIGNED, {
      releaseDate: game.firstReleaseDate.toISOString().slice(0, 10),
      inCatalog: verdict.accepted,
    });
  }
  if (before.inCatalog !== verdict.accepted) {
    flag(ReviewFlagKind.VERDICT_CHANGED, {
      inCatalog: verdict.accepted,
      verdict,
      criteriaChanged: before.criteriaVersion !== input.criteriaVersion,
      postLaunchGraceEnded:
        !verdict.accepted &&
        verdict.reason === 'NO_INTEREST_SIGNAL' &&
        isWithinPostLaunchGrace(game, input.criteria, before.evaluatedAt) &&
        !isWithinPostLaunchGrace(game, input.criteria, input.now),
    });
  }
  return flags;
}

function companyFlags(game: MappedGame, input: ReviewFlagInput): ReviewFlag[] {
  const { criteria } = input;
  const isListed = (list: { igdbId: number }[], igdbId: number) =>
    list.some((entry) => entry.igdbId === igdbId);
  const reviewed = (igdbId: number) => criteria.reviewedCompanies.find((c) => c.igdbId === igdbId);
  const flags: ReviewFlag[] = [];
  const flag = (kind: ReviewFlagKind, detail: Record<string, unknown>) =>
    flags.push({ kind, igdbId: game.igdbId, gameName: game.name, detail });

  for (const developer of game.companies.filter((c) => c.isDeveloper)) {
    if (
      isListed(criteria.majorCompanies, developer.igdbId) ||
      isListed(criteria.controlledStudios, developer.igdbId)
    ) {
      continue;
    }

    const review = reviewed(developer.igdbId);
    if (review?.decision === 'no_current_effect') {
      const referenceYear = (game.firstReleaseDate ?? input.now).getUTCFullYear();
      if (referenceYear >= review.acquiredYear!) {
        flag(ReviewFlagKind.NO_EFFECT_STUDIO, {
          developer: developer.name,
          group: review.group,
          acquiredYear: review.acquiredYear,
          referenceYear,
          referenceDateSource: game.firstReleaseDate ? 'RELEASE' : 'EVALUATION',
        });
      }
      continue;
    }
    if (review) continue;

    const ancestors = ancestorsOf(developer.igdbId, input.companies);
    if (ancestors.length === 0 || ancestors.some((id) => reviewed(id))) continue;
    const chain = ancestors.map((id) => input.companies.get(id)!.name);
    const major = ancestors.find((id) => isListed(criteria.majorCompanies, id));
    flag(
      major === undefined
        ? ReviewFlagKind.PARENT_OUTSIDE_MAJORS
        : ReviewFlagKind.PARENT_MAJOR_NOT_CONTROLLED,
      { developer: developer.name, developerIgdbId: developer.igdbId, parentChain: chain },
    );
  }
  return flags;
}

// Da empresa-mãe mais próxima à mais distante; a IGDB tem empresas que apontam para si mesmas.
export function ancestorsOf(igdbId: number, companies: ReadonlyMap<number, IgdbCompanyNode>) {
  const ancestors: number[] = [];
  const seen = new Set([igdbId]);
  for (let parent = companies.get(igdbId)?.parentIgdbId ?? null; parent !== null;) {
    if (seen.has(parent) || !companies.has(parent)) break;
    seen.add(parent);
    ancestors.push(parent);
    parent = companies.get(parent)!.parentIgdbId;
  }
  return ancestors;
}
