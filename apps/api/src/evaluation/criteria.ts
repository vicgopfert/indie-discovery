import { DiscoveryMode, FeatureType } from '../generated/prisma/client';
import type { ContentIndex } from '../modules/recommendation/content-index';
import { type Interest, pickInterests } from '../modules/recommendation/scoring/interests';
import { interestListKey, listAttribute } from '../modules/recommendation/scoring/lists';
import { overview } from '../modules/recommendation/scoring/overview';
import { buildProfile, interactionsOf } from '../modules/recommendation/scoring/profile';
import { recommend } from '../modules/recommendation/scoring/recommend';
import type { ScoringConfig } from '../modules/recommendation/scoring/scoring-config';
import type { EvaluationConfig } from './evaluation-config';
import type { EvaluationProfile, RatedGame } from './profiles';

// Os critérios C1 a C5 da regra de prateleiras (B-77, mantidos no B-79; docs/etiquetas.md, seção
// 6), pela implementação: as prateleiras "mostradas" são as que a visão geral do modo Equilibrado
// mostra, depois das prateleiras por jogo e da remoção dos repetidos.
export interface CriteriaInput {
  index: ContentIndex;
  hidden: ReadonlySet<number>;
  scoring: ScoringConfig;
  evaluation: EvaluationConfig;
  // O nome em inglês da etiqueta na posição, do vocabulário; nulo fora das etiquetas.
  englishName: (position: number) => string | null;
  // O nome mostrado ao jogador: o rótulo em português dos gêneros e temas, o nome das etiquetas.
  displayName: (position: number) => string;
  // A ordem de popularidade dos jogos do caso RPG com terror.
  popularityCount: readonly number[];
  // Os 200 perfis por avaliações e os 200 por preferências da semente 71.
  seedRated: readonly (readonly RatedGame[])[];
  seedPreferred: readonly (readonly number[])[];
  // Os perfis coerentes do sorteio uniforme, os do B-77.
  coherent: readonly EvaluationProfile[];
}

export interface Shelf {
  name: string;
  documentRatio: number;
  support: number;
}

export interface CriteriaResult {
  regression: { games: readonly string[]; shelves: readonly Shelf[] };
  c1Original: boolean;
  c1Revised: boolean;
  c2: boolean;
  realistic: readonly { title: string; shelves: readonly Shelf[]; passes: boolean }[];
  c3: boolean;
  c4: { passing: number; total: number };
  c5: { main: number; second: number; none: number };
  c5Passes: { main: boolean; second: boolean; none: boolean };
  // Perfis em que dois interesses dizem a mesma ideia, em todos os conjuntos.
  repeatedIdeas: number;
  // A frequência no catálogo das prateleiras de interesse mostradas nos perfis com gosto (o caso
  // de regressão, os realistas e os coerentes), sem as preferências.
  specificity: { shelves: number; median: number | null; aboveTenPercent: number | null };
}

interface Run {
  interests: readonly Interest[];
  shown: readonly Interest[];
  preferences: ReadonlySet<number>;
}

export function evaluateCriteria(input: CriteriaInput): CriteriaResult {
  const { index, evaluation } = input;
  const { cases, criteria } = evaluation;
  const slugToId = new Map(index.games.map(({ slug, id }) => [slug, id]));
  const idOf = (slug: string) => {
    const id = slugToId.get(slug);
    if (id === undefined) throw new Error(`Jogo fora do índice: ${slug}.`);
    return id;
  };
  const shelvesOf = ({ shown }: Run) =>
    shown.map(({ position, supportGameIds }) => ({
      name: input.displayName(position),
      documentRatio: index.features[position]!.documentRatio,
      support: supportGameIds.length,
    }));
  const runs: Run[] = [];
  const execute = (
    ratings: readonly RatedGame[],
    preferences: readonly number[],
    userId: string,
  ) => {
    const run = runProfile(input, ratings, preferences, userId);
    runs.push(run);
    return run;
  };

  const primary = regressionPrimary(input);
  const secondary = cases.regression.secondary.map(idOf);
  const regression = execute(
    [...primary, ...secondary].map((gameId) => ({ gameId, score: 5 })),
    [],
    'regressao',
  );
  const pattern = new RegExp(cases.regression.secondaryPattern);
  const matchesSecondary = (position: number) =>
    pattern.test(input.englishName(position) ?? index.features[position]!.name);
  const c1Original = regression.shown.some(
    ({ supportGameIds }) =>
      supportGameIds.length >= 2 && supportGameIds.every((id) => secondary.includes(id)),
  );
  const c1Revised = regression.shown.some(
    ({ position, supportGameIds }) =>
      matchesSecondary(position) && secondary.every((id) => supportGameIds.includes(id)),
  );
  const c2 = !regression.interests.some(
    ({ position, supportGameIds }) =>
      index.features[position]!.type === FeatureType.TAG &&
      !regression.preferences.has(position) &&
      supportGameIds.length < 2,
  );

  const realistic = Object.entries(cases.realistic).map(([title, rated]) => {
    const run = execute(
      rated.map(([slug, score]) => ({ gameId: idOf(slug), score })),
      [],
      `real-${title}`,
    );
    const passes =
      run.shown.length >= criteria.minShelves &&
      run.shown.some(({ position }) => index.features[position]!.type === FeatureType.TAG);
    return { title, shelves: shelvesOf(run), passes, run };
  });
  const c3 = realistic
    .filter(({ title }) => !cases.realisticOnlyRecord.includes(title))
    .every(({ passes }) => passes);

  const c4 = input.seedPreferred.filter(
    (preferences, i) => execute([], preferences, `pref-${i}`).shown.length >= criteria.minShelves,
  ).length;

  let main = 0;
  let second = 0;
  let none = 0;
  const coherentRuns = input.coherent.map(({ ratings, tastes }, i) => {
    const run = execute(ratings, [], `coerente-${i}`);
    const only = (games: readonly string[]) =>
      run.shown.some(
        ({ supportGameIds }) =>
          supportGameIds.length >= 2 && supportGameIds.every((id) => games.includes(id)),
      );
    if (only(tastes!.main)) main++;
    if (only(tastes!.second)) second++;
    if (run.shown.length === 0) none++;
    return run;
  });
  input.seedRated.forEach((ratings, i) => execute(ratings, [], `aleatorio-${i}`));

  const total = input.coherent.length;
  const c5 = { main: main / total, second: second / total, none: none / total };
  const ratios = [regression, ...realistic.map(({ run }) => run), ...coherentRuns]
    .flatMap(({ shown, preferences }) => shown.filter(({ position }) => !preferences.has(position)))
    .map(({ position }) => index.features[position]!.documentRatio)
    .sort((a, b) => a - b);

  return {
    regression: {
      games: [...primary, ...secondary].map(
        (id) => index.games[index.positionByGameId.get(id)!]!.slug,
      ),
      shelves: shelvesOf(regression),
    },
    c1Original,
    c1Revised,
    c2,
    realistic: realistic.map(({ title, shelves, passes }) => ({ title, shelves, passes })),
    c3,
    c4: { passing: c4, total: input.seedPreferred.length },
    c5,
    c5Passes: {
      main: c5.main >= criteria.coherentMain,
      second: c5.second >= criteria.coherentSecond,
      none: c5.none <= criteria.coherentNone,
    },
    repeatedIdeas: runs.filter(
      ({ interests }) =>
        new Set(interests.map(({ position }) => index.features[position]!.idea)).size !==
        interests.length,
    ).length,
    specificity: {
      shelves: ratios.length,
      median: median(ratios),
      aboveTenPercent:
        ratios.length === 0 ? null : ratios.filter((ratio) => ratio > 0.1).length / ratios.length,
    },
  };
}

// Os jogos com o gênero e o tema do gosto principal, pela popularidade e pelo id.
function regressionPrimary({ index, evaluation, popularityCount }: CriteriaInput): string[] {
  const { primaryGenre, primaryTheme, primaryCount } = evaluation.cases.regression;
  const positionOf = (type: FeatureType, slug: string) => {
    const position = index.features.findIndex((f) => f.type === type && f.slug === slug);
    if (position < 0) throw new Error(`Atributo fora do índice: ${type} ${slug}.`);
    return position;
  };
  const genre = positionOf(FeatureType.GENRE, primaryGenre);
  const theme = positionOf(FeatureType.THEME, primaryTheme);
  return index.games
    .map((game, position) => ({ game, position }))
    .filter(
      ({ game }) => game.featurePositions.includes(genre) && game.featurePositions.includes(theme),
    )
    .sort(
      (a, b) =>
        popularityCount[b.position]! - popularityCount[a.position]! ||
        (a.game.id < b.game.id ? -1 : 1),
    )
    .slice(0, primaryCount)
    .map(({ game }) => game.id);
}

function runProfile(
  { index, hidden, scoring }: CriteriaInput,
  ratings: readonly RatedGame[],
  preferences: readonly number[],
  userId: string,
): Run {
  const interactions = interactionsOf(index, {
    ratings: ratings.map(({ gameId, score }) => ({ gameId, score, ratedAt: 0 })),
    listEntries: [],
    unindexedGames: new Map(),
  });
  const profile = buildProfile(interactions, preferences, index.features.length, scoring);
  const interests = pickInterests(profile, preferences, index, hidden, scoring);
  const result = recommend(
    index,
    {
      userId,
      mode: DiscoveryMode.BALANCED,
      interactions,
      preferencePositions: preferences,
      hiddenPositions: hidden,
    },
    scoring,
  );
  const shownKeys = new Set(overview(result.lists, scoring.lists).map(({ list }) => list.key));
  return {
    interests,
    shown: interests.filter(({ position }) =>
      shownKeys.has(interestListKey(listAttribute(position, index))),
    ),
    preferences: new Set(preferences),
  };
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
