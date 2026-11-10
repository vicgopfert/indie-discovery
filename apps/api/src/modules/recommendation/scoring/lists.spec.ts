import { DiscoveryMode, ReleaseStatus } from '../../../generated/prisma/client';
import type { IndexedGame } from '../content-index';
import { pickInterests } from './interests';
import { type LikedGame, pickLikedGames } from './liked-games';
import { buildLists, interleave, type ListOptions, type RankedList } from './lists';
import { buildProfile } from './profile';
import { scoreCandidates } from './score';
import type { ListsConfig } from './scoring-config';
import {
  candidateList,
  featurePosition,
  gameId,
  gameOf,
  rated,
  SHELF_LIBRARY,
  scoringConfig,
  shelfIndex,
  TAGGED_LIBRARY,
  taggedIndex,
  TASTE_LIBRARY,
  tasteIndex,
} from './scoring.fixture';
import { SimilarityCache } from './source-similarity';
import { userTieBreak } from './tie-break';

const game = (id: string) => ({ id }) as IndexedGame;
const ids = (games: readonly IndexedGame[]) => games.map(({ id }) => id);

describe('interleave', () => {
  const a = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(game);
  const b = ['b1', 'b2', 'b3'].map(game);

  it('preenche cada posição pela prateleira de maior déficit em relação à cota', () => {
    // Cotas de 75% e 25%: déficits 0,75 contra 0,25; depois 0,5 contra 0,5 (empate fica com a
    // de maior cota); depois 0,25 contra 0,75; e assim por diante.
    expect(ids(interleave([a, b], [0.75, 0.25], [], 9))).toEqual([
      'a1',
      'a2',
      'b1',
      'a3',
      'a4',
      'a5',
      'b2',
      'a6',
      'b3',
    ]);
  });

  it('esgotadas as prateleiras, segue pelo resto na ordem dele, sem repetir', () => {
    const rest = ['a1', 'r1', 'b2', 'r2', 'r3'].map(game);

    expect(ids(interleave([a.slice(0, 1), b.slice(0, 1)], [0.5, 0.5], rest, 4))).toEqual([
      'a1',
      'b1',
      'r1',
      'b2',
    ]);
  });

  it('o jogo de dois interesses conta para a prateleira que o pôs e não volta pela outra', () => {
    const shared = game('ab');
    const result = interleave(
      [
        [shared, a[0]!],
        [shared, b[0]!],
      ],
      [0.5, 0.5],
      [],
      10,
    );

    expect(ids(result)).toEqual(['ab', 'b1', 'a1']);
  });

  it('para no teto', () => {
    expect(interleave([a, b], [0.75, 0.25], [], 3)).toHaveLength(3);
  });
});

describe('buildLists', () => {
  const index = tasteIndex();
  const hidden = new Set([featurePosition(index, 'indie')]);
  const library = TASTE_LIBRARY.map((slug) => rated(index, slug, 5));

  function listsOf(
    mode: DiscoveryMode = DiscoveryMode.BALANCED,
    lists: Partial<ListsConfig> = {},
    interactions = library,
  ) {
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    const interests = pickInterests(profile, [], index, hidden, scoringConfig);
    const excludedGameIds = new Set(interactions.map(({ gameId }) => gameId));
    const scored = scoreCandidates(index, profile, { mode, excludedGameIds }, scoringConfig);
    const built = buildLists(
      scored,
      index,
      { mode, popularityWeight: 0, interests, likedGames: [], tieBreak: userTieBreak('u-1') },
      { ...scoringConfig.lists, ...lists },
    );
    const byKey = new Map(built.map((list) => [list.key, list]));
    return { built, byKey, candidates: candidateList(index, scored) };
  }
  const slugs = (list: RankedList | undefined) => list!.games.map(({ slug }) => slug);

  it('põe as listas na ordem da página: principal, os interesses e "em breve"', () => {
    expect(listsOf().built.map(({ key, kind }) => [key, kind])).toEqual([
      ['main', 'main'],
      ['theme:action', 'interest'],
      ['theme:horror', 'interest'],
      ['upcoming', 'upcoming'],
    ]);
  });

  it('cada prateleira é o recorte dos candidatos com o atributo, na ordem da pontuação do perfil inteiro', () => {
    const { byKey, candidates } = listsOf();
    const horror = featurePosition(index, 'horror');
    const scoreOf = new Map(candidates.map(({ game, score }) => [game.slug, score]));
    const shelf = slugs(byKey.get('theme:horror'));

    expect(shelf.sort()).toEqual(
      candidates
        .filter(({ game }) => game.featurePositions.includes(horror))
        .map(({ game }) => game.slug)
        .sort(),
    );
    const ordered = slugs(byKey.get('theme:horror')).map((slug) => scoreOf.get(slug)!);
    expect(ordered).toEqual([...ordered].sort((x, y) => y - x));
    // O jogo que também tem RPG sobe primeiro.
    expect(slugs(byKey.get('theme:horror'))[0]).toBe('saga-fright');
  });

  it('"em breve" tem só os candidatos não lançados', () => {
    const { byKey } = listsOf();

    expect(
      byKey.get('upcoming')!.games.every((g) => g.releaseStatus === ReleaseStatus.UPCOMING),
    ).toBe(true);
    expect(slugs(byKey.get('upcoming')).sort()).toEqual(['fright-soon', 'saga-soon']);
  });

  it('a principal intercala as prateleiras pelas cotas e depois segue pelo resto', () => {
    const { byKey } = listsOf();
    const main = slugs(byKey.get('main'));
    const interleaved = interleave(
      [byKey.get('theme:action')!.games, byKey.get('theme:horror')!.games],
      [0.75, 0.25],
      [],
      100,
    ).map(({ slug }) => slug);

    expect(main.slice(0, interleaved.length)).toEqual(interleaved);
    expect(main[2]).toBe(slugs(byKey.get('theme:horror'))[0]);
    expect(main.slice(0, 2)).toEqual(slugs(byKey.get('theme:action')).slice(0, 2));
    // Os candidatos sem nenhum dos interesses, como space-only, entram pelo resto, no fim.
    const rest = main.slice(interleaved.length);
    expect(rest).toContain('space-only');
    expect(rest.some((slug) => interleaved.includes(slug))).toBe(false);
  });

  it('com menos de 2 interesses, a principal é a ordem da pontuação', () => {
    const { byKey, candidates } = listsOf(DiscoveryMode.BALANCED, {}, [
      rated(index, 'saga-1', 5),
      rated(index, 'saga-2', 5),
    ]);

    expect(byKey.size).toBe(3);
    const scores = slugs(byKey.get('main')).map(
      (slug) => candidates.find(({ game }) => game.slug === slug)!.score,
    );
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(scores).toHaveLength(candidates.length);
  });

  it('corta cada lista no teto da configuração', () => {
    const { byKey } = listsOf(DiscoveryMode.BALANCED, { mainCap: 5, shelfCap: 6 });

    expect(byKey.get('main')!.games).toHaveLength(5);
    expect(byKey.get('theme:action')!.games).toHaveLength(6);
  });

  it('só no modo Descobertas monta cada lista também com λ = 0, com as mesmas cotas', () => {
    expect(listsOf().built.every(({ bySimilarity }) => bySimilarity === null)).toBe(true);

    const discovery = listsOf(DiscoveryMode.DISCOVERY).byKey;
    const balanced = listsOf(DiscoveryMode.BALANCED).byKey;
    for (const [key, list] of discovery) {
      // No Equilibrado, λ = 0: a ordem dele é a da similaridade.
      expect(ids(list.bySimilarity!)).toEqual(ids(balanced.get(key)!.games));
    }
    expect(ids(discovery.get('main')!.games)).not.toEqual(ids(balanced.get('main')!.games));
  });

  it('o mesmo estado gera as mesmas listas, em qualquer ordem das interações', () => {
    expect(listsOf(DiscoveryMode.DISCOVERY, {}, [...library].reverse()).built).toEqual(
      listsOf(DiscoveryMode.DISCOVERY).built,
    );
  });
});

describe('buildLists com etiquetas', () => {
  const index = taggedIndex();
  const profile = buildProfile(
    TAGGED_LIBRARY.map((slug) => rated(index, slug, 5)),
    [],
    index.features.length,
    scoringConfig,
  );
  const mode = DiscoveryMode.BALANCED;
  const excludedGameIds = new Set(TAGGED_LIBRARY.map((slug) => `g-${slug}`));
  const built = buildLists(
    scoreCandidates(index, profile, { mode, excludedGameIds }, scoringConfig),
    index,
    {
      mode,
      popularityWeight: 0,
      interests: pickInterests(profile, [], index, new Set(), scoringConfig),
      likedGames: [],
      tieBreak: userTieBreak('u-1'),
    },
    scoringConfig.lists,
  );
  const shelf = built.find(({ key }) => key === 'tag:survival-horror')!;

  it('a prateleira da etiqueta traz o atributo e os candidatos que têm a etiqueta', () => {
    expect(shelf.attribute).toEqual({
      type: 'TAG',
      slug: 'survival-horror',
      name: 'Terror de Sobrevivência',
      title: null,
    });
    expect(shelf.games.map(({ slug }) => slug).sort()).toEqual(['scare-a', 'scare-b']);
  });

  // A etiqueta vem antes na página, pela fase 1, com cota de 25% contra 75% de Fantasia: a
  // primeira posição é de Fantasia, e a segunda empata no déficit e fica com a etiqueta.
  it('a principal intercala a etiqueta pela cota dela', () => {
    const main = built.find(({ key }) => key === 'main')!.games.map(({ slug }) => slug);

    expect(built.map(({ key }) => key)).toEqual([
      'main',
      'tag:survival-horror',
      'theme:fantasy',
      'upcoming',
    ]);
    expect(main[1]).toBe(shelf.games[0]!.slug);
    expect(main[0]).not.toBe(shelf.games[0]!.slug);
  });
});

describe('buildLists: prateleiras por jogo', () => {
  const index = shelfIndex();
  const library = SHELF_LIBRARY.map((slug) => rated(index, slug, 5));
  const profile = buildProfile(library, [], index.features.length, scoringConfig);
  const interests = pickInterests(profile, [], index, new Set(), scoringConfig);
  const likedGames = pickLikedGames(library, interests, scoringConfig);
  const excludedGameIds = new Set(library.map(({ gameId }) => gameId));
  const listsIn = (mode: DiscoveryMode) =>
    buildLists(
      scoreCandidates(index, profile, { mode, excludedGameIds }, scoringConfig),
      index,
      {
        mode,
        popularityWeight: scoringConfig.popularityWeightByMode[mode],
        interests,
        likedGames,
        tieBreak: userTieBreak('u-1'),
      },
      scoringConfig.lists,
    );
  const balanced = listsIn(DiscoveryMode.BALANCED);
  const cosine = (source: string, slug: string) => {
    const a = gameOf(index, source);
    const b = gameOf(index, slug);
    let dot = 0;
    a.featurePositions.forEach((p, i) => {
      const j = b.featurePositions.indexOf(p);
      if (j >= 0) dot += a.weights[i]! * b.weights[j]!;
    });
    return dot;
  };

  it('vêm logo depois da principal, antes dos interesses e de "em breve"', () => {
    // Amnesia é o gosto de um jogo só; entre os outros, empatados no peso, vale o id.
    expect(balanced.map(({ key }) => key)).toEqual([
      'main',
      'game:amnesia',
      'game:celeste',
      'tag:platformer',
      'tag:roguelike',
      'genre:rpg',
      'tag:difficult',
      'upcoming',
    ]);
    expect(balanced[1]).toMatchObject({
      kind: 'liked-game',
      attribute: null,
      likedGameId: gameId('amnesia'),
    });
  });

  it('trazem os candidatos do perfil com algum atributo do jogo, pela semelhança com ele', () => {
    const shelf = balanced.find(({ key }) => key === 'game:celeste')!;
    const slugs = shelf.games.map(({ slug }) => slug);

    expect(slugs.sort()).toEqual(['hard-a', 'hard-b', 'metro-a', 'metro-b', 'plat-a']);
    const similarities = shelf.games.map(({ slug }) => cosine('celeste', slug));
    expect(similarities).toEqual([...similarities].sort((x, y) => y - x));
    expect(shelf.bySimilarity).toBeNull();
  });

  it('no modo Descobertas, descontam a popularidade e guardam a ordem só pela semelhança', () => {
    const shelf = listsIn(DiscoveryMode.DISCOVERY).find(({ key }) => key === 'game:celeste')!;
    const lambda = scoringConfig.popularityWeightByMode.DISCOVERY;
    const scores = shelf.games.map(
      ({ slug }) => cosine('celeste', slug) - lambda * gameOf(index, slug).popularityNorm,
    );
    const similarities = shelf.bySimilarity!.map(({ slug }) => cosine('celeste', slug));

    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(similarities).toEqual([...similarities].sort((x, y) => y - x));
  });

  it('não trazem jogo da biblioteca nem candidato sem atributo a favor no perfil', () => {
    const shelf = balanced.find(({ key }) => key === 'game:amnesia')!;

    expect(shelf.games.map(({ slug }) => slug)).toEqual(['fright-a']);
  });
});

describe('buildLists: só a lista pedida', () => {
  const index = shelfIndex();
  const library = SHELF_LIBRARY.map((slug) => rated(index, slug, 5));
  const profile = buildProfile(library, [], index.features.length, scoringConfig);
  const interests = pickInterests(profile, [], index, new Set(), scoringConfig);
  const likedGames = pickLikedGames(library, interests, scoringConfig);
  const excludedGameIds = new Set(library.map(({ gameId }) => gameId));
  const listsIn = (mode: DiscoveryMode, extra: Partial<ListOptions> = {}) =>
    buildLists(
      scoreCandidates(index, profile, { mode, excludedGameIds }, scoringConfig),
      index,
      {
        mode,
        popularityWeight: scoringConfig.popularityWeightByMode[mode],
        interests,
        likedGames,
        tieBreak: userTieBreak('u-1'),
        ...extra,
      },
      scoringConfig.lists,
    );

  it.each([DiscoveryMode.POPULAR, DiscoveryMode.BALANCED, DiscoveryMode.DISCOVERY])(
    'em %s, cada lista pedida sozinha é igual à da visão geral',
    (mode) => {
      const all = listsIn(mode);

      expect(all.map(({ kind }) => kind)).toEqual(
        expect.arrayContaining(['main', 'liked-game', 'interest', 'upcoming']),
      );
      for (const list of all) expect(listsIn(mode, { only: list.key })).toEqual([list]);
    },
  );

  it('a chave que não é do perfil não monta nada', () => {
    expect(listsIn(DiscoveryMode.BALANCED, { only: 'game:amnesia-the-bunker' })).toEqual([]);
    expect(listsIn(DiscoveryMode.BALANCED, { only: 'tag:metroidvania' })).toEqual([]);
  });

  it('a semelhança guardada dá as mesmas listas, e só a lista por jogo a consulta', () => {
    const cache = new SimilarityCache(index, 10);
    const similarityOf = jest.fn((liked: LikedGame) => cache.of(liked));

    expect(listsIn(DiscoveryMode.DISCOVERY, { similarityOf })).toEqual(
      listsIn(DiscoveryMode.DISCOVERY),
    );
    similarityOf.mockClear();
    listsIn(DiscoveryMode.BALANCED, { similarityOf, only: 'main' });
    listsIn(DiscoveryMode.BALANCED, { similarityOf, only: 'tag:roguelike' });
    expect(similarityOf).not.toHaveBeenCalled();
    listsIn(DiscoveryMode.BALANCED, { similarityOf, only: 'game:celeste' });
    expect(similarityOf).toHaveBeenCalledTimes(1);
  });
});
