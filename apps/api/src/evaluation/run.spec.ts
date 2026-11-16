import { DiscoveryMode, FeatureType } from '../generated/prisma/client';
import { scoreCandidates } from '../modules/recommendation/scoring/score';
import { buildProfile, interactionsOf } from '../modules/recommendation/scoring/profile';
import {
  gameId,
  scoringConfig,
  TAGGED_LIBRARY,
  taggedIndex,
} from '../modules/recommendation/scoring/scoring.fixture';
import type { EvaluationProfile } from './profiles';
import { evaluateProfile, mergeOutcomes, METHODS, type RunContext, singleListConfig } from './run';

const index = taggedIndex();
const context: RunContext = {
  index,
  hidden: new Set(),
  scoring: scoringConfig,
  depth: 10,
  seed: 71,
  methods: METHODS,
};
// O caso de produção do B-78: seis jogos de RPG e fantasia e dois de terror de sobrevivência.
const profile: EvaluationProfile = {
  id: 'perfil-teste',
  family: 'coherent',
  sampling: 'uniform',
  stratum: null,
  ratings: TAGGED_LIBRARY.map((slug) => ({ gameId: gameId(slug), score: 5 })),
  preferencePositions: [],
  holdouts: [gameId('quest-1'), gameId('scare-1')],
};
const library = new Set(profile.ratings.map(({ gameId: id }) => id));

describe('avaliação de um perfil', () => {
  const outcome = evaluateProfile(context, profile);

  it('guarda as listas do perfil inteiro em todos os métodos, sem a biblioteca', () => {
    expect([...outcome.lists.keys()]).toEqual(METHODS);
    for (const { games } of outcome.lists.values()) {
      expect(games.length).toBeGreaterThan(0);
      expect(games.length).toBeLessThanOrEqual(10);
      expect(games.some(({ id }) => library.has(id))).toBe(false);
    }
  });

  it('a lista única segue a pontuação; a intercalada põe o gosto secundário antes', () => {
    const interactions = interactionsOf(index, {
      ratings: profile.ratings.map(({ gameId: id, score }) => ({ gameId: id, score, ratedAt: 0 })),
      listEntries: [],
      unindexedGames: new Map(),
    });
    const candidates = scoreCandidates(
      index,
      buildProfile(interactions, [], index.features.length, scoringConfig),
      { mode: DiscoveryMode.BALANCED, excludedGameIds: library },
      scoringConfig,
    );
    const scoreOf = new Map(
      Array.from({ length: candidates.count }, (_, k) => [
        index.games[candidates.gamePositions[k]!]!.id,
        candidates.score[k]!,
      ]),
    );
    const single = outcome.lists.get('BALANCED/single')!.games.map(({ id }) => scoreOf.get(id)!);
    const interleaved = outcome.lists.get('BALANCED/interleaved')!.games;
    const firstScare = (games: readonly { slug: string }[]) => {
      const position = games.findIndex(({ slug }) => slug.startsWith('scare'));
      return position < 0 ? Infinity : position;
    };

    expect(single).toEqual([...single].sort((a, b) => b - a));
    expect(outcome.interests.length).toBeGreaterThanOrEqual(2);
    expect(firstScare(interleaved)).toBeLessThan(
      firstScare(outcome.lists.get('BALANCED/single')!.games),
    );
  });

  it('com menos de 2 interesses não há intercalação: a lista única é a de 1 interesse', () => {
    expect(singleListConfig(scoringConfig).lists.maxInterests).toBe(1);
    expect(singleListConfig(scoringConfig).popularityWeightByMode).toBe(
      scoringConfig.popularityWeightByMode,
    );
  });

  it('procura cada jogo escondido na lista montada sem ele', () => {
    for (const method of METHODS) {
      const ranks = outcome.ranks.get(method)!;
      expect(ranks).toHaveLength(2);
      expect(ranks.every((rank) => rank >= -1 && rank < 10)).toBe(true);
    }
    // Sem quest-1, os outros cinco jogos de RPG continuam no perfil, e ele volta para a lista.
    expect(outcome.ranks.get('BALANCED/interleaved')![0]).toBeGreaterThanOrEqual(0);
  });

  it('marca "pouco conhecido" só no modo Descobertas', () => {
    for (const [method, { lowKnown }] of outcome.lists) {
      if (method.startsWith(DiscoveryMode.DISCOVERY)) expect(lowKnown).not.toBeNull();
      else expect(lowKnown).toBeNull();
    }
  });

  it('interesses e gêneros e temas positivos do perfil inteiro', () => {
    const types = outcome.genresAndThemes.map((p) => index.features[p]!.type);
    expect(types.every((t) => t === FeatureType.GENRE || t === FeatureType.THEME)).toBe(true);
    expect(outcome.interests.every((p) => p >= 0 && p < index.features.length)).toBe(true);
  });

  it('calcula só as listas pedidas, iguais às da execução completa', () => {
    const method = 'BALANCED/interleaved';
    const only = evaluateProfile({ ...context, methods: [method] }, profile);

    expect([...only.lists.keys()]).toEqual([method]);
    expect([...only.ranks.keys()]).toEqual([method]);
    expect(only.ranks.get(method)).toEqual(outcome.ranks.get(method));
    expect(only.lists.get(method)!.games).toEqual(outcome.lists.get(method)!.games);
  });

  it('junta as listas de outra execução dos mesmos perfis por cima das da base', () => {
    const discovery = 'DISCOVERY/interleaved';
    const other = evaluateProfile({ ...context, methods: [discovery] }, profile);
    const [merged] = mergeOutcomes([outcome], [other]);

    expect([...merged!.lists.keys()]).toEqual(METHODS);
    expect(merged!.lists.get(discovery)).toBe(other.lists.get(discovery));
    expect(merged!.lists.get('BALANCED/interleaved')).toBe(
      outcome.lists.get('BALANCED/interleaved'),
    );
    expect(() => mergeOutcomes([outcome], [{ ...other, profile: { ...profile } }])).toThrow();

    // Só a lista pedida vem da outra execução; as demais ficam as da base.
    const balanced = 'BALANCED/interleaved';
    const [onlyDiscovery] = mergeOutcomes([merged!], [outcome], [balanced]);
    expect(onlyDiscovery!.lists.get(discovery)).toBe(other.lists.get(discovery));
    expect(onlyDiscovery!.lists.get(balanced)).toBe(outcome.lists.get(balanced));
  });

  it('a mesma entrada dá o mesmo resultado', () => {
    const again = evaluateProfile(context, profile);
    expect([...again.ranks]).toEqual([...outcome.ranks]);
    expect([...again.lists].map(([m, { games }]) => [m, games.map(({ id }) => id)])).toEqual(
      [...outcome.lists].map(([m, { games }]) => [m, games.map(({ id }) => id)]),
    );
  });
});
