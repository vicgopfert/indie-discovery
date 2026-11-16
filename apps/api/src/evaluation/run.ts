import { DiscoveryMode, FeatureType } from '../generated/prisma/client';
import type { ContentIndex, IndexedGame } from '../modules/recommendation/content-index';
import { pickInterests } from '../modules/recommendation/scoring/interests';
import { MAIN_LIST_KEY } from '../modules/recommendation/scoring/lists';
import {
  buildProfile,
  type Interaction,
  interactionsOf,
} from '../modules/recommendation/scoring/profile';
import { recommend } from '../modules/recommendation/scoring/recommend';
import type { ScoringConfig } from '../modules/recommendation/scoring/scoring-config';
import { popularBaseline, randomBaseline } from './baselines';
import type { EvaluationProfile } from './profiles';
import { seedOf } from './random';

export const MODES = [DiscoveryMode.POPULAR, DiscoveryMode.BALANCED, DiscoveryMode.DISCOVERY];

// A lista principal intercalada pelas cotas dos interesses (B-71) e a lista única de antes, só pela
// pontuação.
export const LIST_KINDS = ['interleaved', 'single'] as const;
export type ListKind = (typeof LIST_KINDS)[number];

export const BASELINES = ['random', 'popular'] as const;

export type Method = `${DiscoveryMode}/${ListKind}` | (typeof BASELINES)[number];

// A lista principal intercalada de um modo.
export const listOf = (mode: DiscoveryMode): Method => `${mode}/interleaved`;

export const METHODS: readonly Method[] = [
  ...MODES.flatMap((mode) => LIST_KINDS.map((kind): Method => `${mode}/${kind}`)),
  ...BASELINES,
];

export interface RunContext {
  index: ContentIndex;
  hidden: ReadonlySet<number>;
  scoring: ScoringConfig;
  // O maior corte das métricas: o tamanho de cada lista guardada.
  depth: number;
  seed: number;
  // As listas calculadas; as regras da rodada 2 usam só as que comparam.
  methods: readonly Method[];
}

export interface Ranked {
  games: readonly IndexedGame[];
  // Os "pouco conhecidos" entre eles, só no modo Descobertas.
  lowKnown: number | null;
}

export interface ProfileOutcome {
  profile: EvaluationProfile;
  // Os interesses do perfil inteiro (pickInterests), em posições do índice.
  interests: readonly number[];
  // Os gêneros e temas com componente positiva no perfil, a definição antiga da cobertura.
  genresAndThemes: readonly number[];
  lists: ReadonlyMap<Method, Ranked>;
  // A posição de cada jogo escondido na lista sem ele, a partir de 0; -1 fora da profundidade.
  ranks: ReadonlyMap<Method, readonly number[]>;
}

// Com menos de 2 interesses não há o que intercalar: com 1, a principal é a ordem da pontuação.
export function singleListConfig(scoring: ScoringConfig): ScoringConfig {
  return { ...scoring, lists: { ...scoring.lists, maxInterests: 1 } };
}

export function evaluateProfile(context: RunContext, profile: EvaluationProfile): ProfileOutcome {
  const { index, hidden, scoring } = context;
  const interactions = interactionsFor(index, profile, null);
  const vector = buildProfile(
    interactions,
    profile.preferencePositions,
    index.features.length,
    scoring,
  );
  const interests = pickInterests(vector, profile.preferencePositions, index, hidden, scoring);
  const genresAndThemes = index.features.flatMap(({ type }, position) =>
    (type === FeatureType.GENRE || type === FeatureType.THEME) &&
    !hidden.has(position) &&
    vector.vector[position]! > 0
      ? [position]
      : [],
  );

  const ranks = new Map<Method, number[]>(context.methods.map((method) => [method, []]));
  for (const holdout of profile.holdouts) {
    for (const [method, { games }] of rankAll(context, profile, holdout)) {
      ranks.get(method)!.push(games.findIndex((game) => game.id === holdout));
    }
  }
  return {
    profile,
    interests: interests.map(({ position }) => position),
    genresAndThemes,
    lists: rankAll(context, profile, null),
    ranks,
  };
}

// As listas de outra execução dos mesmos perfis por cima das de base: a variante de um λ só calcula
// o modo que muda. Com methods, só essas listas vêm da outra execução.
export function mergeOutcomes(
  base: readonly ProfileOutcome[],
  over: readonly ProfileOutcome[],
  methods?: readonly Method[],
): ProfileOutcome[] {
  const pick = <T>(entries: ReadonlyMap<Method, T>) =>
    [...entries].filter(([method]) => methods === undefined || methods.includes(method));
  return base.map((outcome, i) => {
    const other = over[i]!;
    if (other.profile !== outcome.profile) throw new Error('Execuções de perfis diferentes.');
    return {
      ...outcome,
      lists: new Map([...outcome.lists, ...pick(other.lists)]),
      ranks: new Map([...outcome.ranks, ...pick(other.ranks)]),
    };
  });
}

function interactionsFor(
  index: ContentIndex,
  profile: EvaluationProfile,
  without: string | null,
): Interaction[] {
  return interactionsOf(index, {
    ratings: profile.ratings
      .filter(({ gameId }) => gameId !== without)
      .map(({ gameId, score }) => ({ gameId, score, ratedAt: 0 })),
    listEntries: [],
    unindexedGames: new Map(),
  });
}

function rankAll(
  { index, hidden, scoring, depth, seed, methods }: RunContext,
  profile: EvaluationProfile,
  without: string | null,
): Map<Method, Ranked> {
  const interactions = interactionsFor(index, profile, without);
  const excluded = new Set(interactions.map(({ gameId }) => gameId));
  const single = singleListConfig(scoring);
  const lists = new Map<Method, Ranked>();
  for (const mode of MODES) {
    for (const kind of LIST_KINDS) {
      if (!methods.includes(`${mode}/${kind}`)) continue;
      const [main] = recommend(
        index,
        {
          userId: profile.id,
          mode,
          interactions,
          preferencePositions: profile.preferencePositions,
          hiddenPositions: hidden,
          only: MAIN_LIST_KEY,
        },
        kind === 'single' ? single : scoring,
      ).lists;
      const games = main!.games.slice(0, depth);
      // A mesma regra da visão geral e do "ver mais": fora dos primeiros da lista sem popularidade.
      const reference = main!.bySimilarity && new Set(main!.bySimilarity.slice(0, games.length));
      lists.set(`${mode}/${kind}`, {
        games,
        lowKnown: reference ? games.filter((game) => !reference.has(game)).length : null,
      });
    }
  }
  if (methods.includes('random')) {
    lists.set('random', {
      games: randomBaseline(index, excluded, depth, seedOf(seed, profile.id, without ?? '')),
      lowKnown: null,
    });
  }
  if (!methods.includes('popular')) return lists;
  lists.set('popular', {
    games: popularBaseline(
      index,
      hidden,
      {
        ratings: profile.ratings.filter(({ gameId }) => gameId !== without),
        preferencePositions: profile.preferencePositions,
      },
      excluded,
      depth,
      profile.id,
    ),
    lowKnown: null,
  });
  return lists;
}
