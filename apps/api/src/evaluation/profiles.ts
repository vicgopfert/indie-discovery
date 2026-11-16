import { FeatureType, ReleaseStatus } from '../generated/prisma/client';
import { type ContentIndex, isLabeledFeatureType } from '../modules/recommendation/content-index';
import type { EvaluationConfig } from './evaluation-config';
import { mulberry32, sample, seedOf, weightedSample } from './random';

export type Sampling = 'uniform' | 'popularity';

export const SAMPLINGS: readonly Sampling[] = ['uniform', 'popularity'];

export type Family = 'attribute' | 'coherent' | 'cold-start' | 'seed';

export const ATTRIBUTE_TYPES = [FeatureType.GENRE, FeatureType.THEME, FeatureType.TAG] as const;

export interface RatedGame {
  gameId: string;
  score: number;
}

export interface EvaluationProfile {
  // Também o usuário do desempate.
  id: string;
  family: Family;
  sampling: Sampling | null;
  // O tipo do atributo, na família A; avaliações ou preferências, na semente 71.
  stratum: string | null;
  ratings: readonly RatedGame[];
  // Posições, no índice, dos atributos preferidos.
  preferencePositions: readonly number[];
  // Os jogos escondidos, um de cada vez, no acerto por omissão.
  holdouts: readonly string[];
  // O atributo dos jogos bem avaliados, na família A.
  attribute?: number;
  // Os dois gostos de um perfil coerente, para o C5.
  tastes?: { main: readonly string[]; second: readonly string[] };
}

// O que o índice não guarda e os sorteios usam, na posição de cada jogo do índice.
export interface ProfileCatalog {
  index: ContentIndex;
  hidden: ReadonlySet<number>;
  popularityCount: readonly number[];
  names: readonly string[];
}

// As posições dos jogos de cada atributo, na ordem do índice.
export function postingsOf({ games, features }: ContentIndex): number[][] {
  const postings = features.map((): number[] => []);
  games.forEach(({ featurePositions }, game) => {
    for (const position of featurePositions) postings[position]!.push(game);
  });
  return postings;
}

function drawer(catalog: ProfileCatalog, sampling: Sampling) {
  return (random: () => number, games: readonly number[], count: number) =>
    sampling === 'uniform'
      ? sample(random, games, count)
      : weightedSample(random, games, (game) => catalog.popularityCount[game]!, count);
}

const rate = (catalog: ProfileCatalog, games: readonly number[], scores: readonly number[]) =>
  games.map((game, i) => ({ gameId: catalog.index.games[game]!.id, score: scores[i]! }));

// Família A (seção 12 da proposta técnica): para cada tipo, o mesmo número de perfis, distribuídos
// em rodízio pelos atributos do tipo em ordem sorteada. Cada perfil avalia bem jogos com o
// atributo e mal jogos sem ele.
export function attributeProfiles(
  catalog: ProfileCatalog,
  sampling: Sampling,
  { seed, attributeProfiles: config }: EvaluationConfig,
): EvaluationProfile[] {
  const { index, hidden } = catalog;
  const postings = postingsOf(index);
  const withVector = index.games.flatMap((game, position) =>
    game.weights.length > 0 ? [position] : [],
  );
  const draw = drawer(catalog, sampling);

  return ATTRIBUTE_TYPES.flatMap((type) => {
    const eligible = index.features.flatMap(({ type: featureType, gameKind }, position) =>
      featureType === type &&
      (isLabeledFeatureType(type) ? !hidden.has(position) : gameKind) &&
      postings[position]!.length >= config.minGames
        ? [position]
        : [],
    );
    const random = mulberry32(seedOf(seed, 'attribute', sampling, type));
    const order = sample(random, eligible, eligible.length);
    return Array.from({ length: config.profilesPerType }, (_, i): EvaluationProfile => {
      const attribute = order[i % order.length]!;
      const has = new Set(postings[attribute]);
      const positives = draw(random, postings[attribute]!, config.positiveScores.length);
      const negatives = draw(
        random,
        withVector.filter((game) => !has.has(game)),
        config.negativeScores.length,
      );
      const ratings = [
        ...rate(catalog, positives, config.positiveScores),
        ...rate(catalog, negatives, config.negativeScores),
      ];
      return {
        id: `atributo-${sampling}-${type.toLowerCase()}-${i}`,
        family: 'attribute',
        sampling,
        stratum: type,
        attribute,
        ratings,
        preferencePositions: [],
        holdouts: ratings.slice(0, positives.length).map(({ gameId }) => gameId),
      };
    });
  });
}

// Família B: os perfis coerentes do B-77. No sorteio uniforme, a mesma sequência de antes (semente
// e ordem dos sorteios), para o C5 continuar comparável.
export function coherentProfiles(
  catalog: ProfileCatalog,
  sampling: Sampling,
  { seed, coherentProfiles: config }: EvaluationConfig,
): EvaluationProfile[] {
  const { index } = catalog;
  const postings = postingsOf(index);
  const eligible = index.features.flatMap(({ type, shelf, documentRatio }, position) =>
    type === FeatureType.TAG &&
    shelf &&
    documentRatio <= config.maxDocumentRatio &&
    postings[position]!.length >= config.minGames
      ? [position]
      : [],
  );
  const random = mulberry32(sampling === 'uniform' ? seed : seedOf(seed, 'coherent', sampling));
  const draw = drawer(catalog, sampling);

  const profiles: EvaluationProfile[] = [];
  while (profiles.length < config.count) {
    const first = eligible[Math.floor(random() * eligible.length)]!;
    const main = draw(random, postings[first]!, config.mainScores.length);
    const second = eligible[Math.floor(random() * eligible.length)]!;
    if (second === first) continue;
    const pool = postings[second]!.filter(
      (game) => !main.includes(game) && !index.games[game]!.featurePositions.includes(first),
    );
    if (pool.length < config.secondScores.length) continue;
    const rest = draw(random, pool, config.secondScores.length);
    const mainRatings = rate(catalog, main, config.mainScores);
    const secondRatings = rate(catalog, rest, config.secondScores);
    profiles.push({
      id:
        sampling === 'uniform'
          ? `coerente-${profiles.length}`
          : `coerente-${sampling}-${profiles.length}`,
      family: 'coherent',
      sampling,
      stratum: null,
      ratings: [...mainRatings, ...secondRatings],
      preferencePositions: [],
      holdouts: [mainRatings[0]!.gameId, secondRatings[0]!.gameId],
      tastes: {
        main: mainRatings.map(({ gameId }) => gameId),
        second: secondRatings.map(({ gameId }) => gameId),
      },
    });
  }
  return profiles;
}

// Família C: a partida a frio do B-34, com as opções oferecidas (`options`, posições no índice).
// Os jogos avaliados são os primeiros da lista de jogos para avaliar.
export function coldStartProfiles(
  catalog: ProfileCatalog,
  options: readonly number[],
  { seed, coldStartProfiles: config }: EvaluationConfig,
): EvaluationProfile[] {
  const { index } = catalog;
  const postings = postingsOf(index);
  const above = options.filter((position) => {
    const { type, documentRatio } = index.features[position]!;
    return type === FeatureType.TAG && documentRatio > config.aboveDocumentRatio;
  });
  const random = mulberry32(seedOf(seed, 'cold-start'));
  const block = config.count / (config.ratedScores.length + 1);

  return Array.from({ length: config.count }, (_, i): EvaluationProfile => {
    const preferences = sample(random, options, config.preferences);
    if (i % config.aboveEvery === 0 && above.length > 0) {
      const tag = above[(i / config.aboveEvery) % above.length]!;
      if (!preferences.includes(tag)) preferences[preferences.length - 1] = tag;
    }
    const games = onboardingGames(catalog, postings, preferences, Math.floor(i / block));
    const ratings = rate(catalog, games, config.ratedScores);
    return {
      id: `partida-a-frio-${i}`,
      family: 'cold-start',
      sampling: null,
      stratum: null,
      ratings,
      preferencePositions: preferences,
      holdouts: ratings.map(({ gameId }) => gameId),
    };
  });
}

// A ordem de GET /api/me/onboarding/games (LibraryRepository.findOnboardingGames): os lançados de
// cada preferência por popularidade, nome e id, em rodadas. Os `limit` primeiros de cada
// preferência bastam para os `limit` primeiros da lista.
export function onboardingGames(
  { index, names }: ProfileCatalog,
  postings: readonly (readonly number[])[],
  preferences: readonly number[],
  limit: number,
): number[] {
  const compare = (a: number, b: number) => {
    const ga = index.games[a]!;
    const gb = index.games[b]!;
    return (
      gb.popularityNorm - ga.popularityNorm ||
      (names[a]! < names[b]! ? -1 : names[a]! > names[b]! ? 1 : 0) ||
      (ga.id < gb.id ? -1 : ga.id > gb.id ? 1 : 0)
    );
  };
  const round = new Map<number, number>();
  for (const preference of preferences) {
    postings[preference]!.filter(
      (game) => index.games[game]!.releaseStatus === ReleaseStatus.RELEASED,
    )
      .sort(compare)
      .slice(0, limit)
      .forEach((game, i) => round.set(game, Math.min(round.get(game) ?? Infinity, i)));
  }
  return [...round.keys()]
    .sort((a, b) => round.get(a)! - round.get(b)! || compare(a, b))
    .slice(0, limit);
}
