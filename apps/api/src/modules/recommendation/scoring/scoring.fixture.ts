import { FeatureType, type ListType, ReleaseStatus } from '../../../generated/prisma/client';
import {
  buildContentIndex,
  type ContentIndex,
  type ContentIndexRows,
  type IndexedGame,
} from '../content-index';
import { readTfidfConfig } from '../tfidf';
import type { Interaction } from './profile';
import { readScoringConfig, type ScoringConfig } from './scoring-config';
import type { ScoredCandidates } from './score';

const { GENRE, THEME, TAG } = FeatureType;

export const featureId = (slug: string) => `f-${slug}`;

// Só nas etiquetas, o que o vocabulário diz delas na API: shelf, se pode virar prateleira, e, nas
// que podem, se é de gênero ou subgênero, o título e o gênero ou tema com a mesma ideia.
type FixtureFeature = ContentIndexRows['features'][number] & {
  shelf?: boolean;
  gameKind?: boolean;
  title?: string;
  sameIdeaAs?: string;
};

const FILLER_FEATURE: FixtureFeature = {
  id: featureId('filler'),
  type: TAG,
  igdbId: 99,
  slug: 'filler',
  name: 'Enchimento',
  idf: 0.5,
};

// Na mesma ordem do repositório: tipo e igdbId.
export const FEATURES: FixtureFeature[] = [
  {
    id: featureId('roguelike'),
    type: GENRE,
    igdbId: 1,
    slug: 'roguelike',
    name: 'Roguelike',
    idf: 1.5,
  },
  {
    id: featureId('platform'),
    type: GENRE,
    igdbId: 2,
    slug: 'platform',
    name: 'Platform',
    idf: 1.2,
  },
  { id: featureId('puzzle'), type: GENRE, igdbId: 3, slug: 'puzzle', name: 'Puzzle', idf: 1.4 },
  { id: featureId('fantasy'), type: THEME, igdbId: 1, slug: 'fantasy', name: 'Fantasy', idf: 1 },
  { id: featureId('horror'), type: THEME, igdbId: 2, slug: 'horror', name: 'Horror', idf: 1.6 },
  {
    id: featureId('pixel-art'),
    type: TAG,
    igdbId: 1,
    slug: 'pixel-art',
    name: 'Pixel Art',
    idf: 1.1,
  },
  {
    id: featureId('rock-climbing'),
    type: TAG,
    igdbId: 2,
    slug: 'rock-climbing',
    name: 'Escalada',
    idf: 3,
    shelf: true,
  },
  FILLER_FEATURE,
];

// [atributos, popularidade normalizada, situação (lançado se omitida)]
type FixtureGames = Record<string, [string[], number, ReleaseStatus?]>;

// No catálogo real, cada gênero ou tema está numa fração pequena dos jogos; num fixture de uma
// dúzia, quase todos passariam do limite de frequência dos interesses. Os jogos de enchimento só
// têm uma etiqueta própria, sem prateleira: não mudam os vetores dos outros nem viram candidatos.
function fillers(prefix: string, count: number, features: string[]): FixtureGames {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`${prefix}-${i + 1}`, [features, 0.01]]),
  );
}

const GAMES: FixtureGames = {
  'dead-cells': [['roguelike', 'platform', 'fantasy', 'pixel-art'], 0.6],
  hades: [['roguelike', 'fantasy'], 0.9],
  'popular-rogue': [['roguelike', 'fantasy'], 0.95],
  'obscure-rogue': [['roguelike', 'fantasy'], 0.05],
  spelunky: [['roguelike', 'platform', 'pixel-art'], 0.7],
  celeste: [['platform', 'pixel-art', 'rock-climbing'], 0.8],
  'climb-only': [['rock-climbing'], 0.4],
  'free-solo': [['rock-climbing', 'pixel-art'], 0.2],
  inside: [['platform', 'puzzle', 'horror'], 0.75],
  limbo: [['platform', 'puzzle', 'horror'], 0.75],
  'horror-only': [['horror'], 0.3],
  'no-tags': [[], 0.99],
  ...fillers('filler', 20, ['filler']),
};

// O perfil visto em produção (B-71): um gosto dominante de atributos que andam juntos (RPG,
// Aventura, Fantasia e Ação nos mesmos jogos) e um secundário (terror) sem nenhum deles. Indie
// está em todos, como no catálogo, e é o atributo escondido dos filtros.
const TASTE_FEATURES: FixtureFeature[] = [
  { id: featureId('rpg'), type: GENRE, igdbId: 1, slug: 'rpg', name: 'RPG', idf: 1 },
  {
    id: featureId('adventure'),
    type: GENRE,
    igdbId: 2,
    slug: 'adventure',
    name: 'Adventure',
    idf: 1,
  },
  { id: featureId('shooter'), type: GENRE, igdbId: 3, slug: 'shooter', name: 'Shooter', idf: 1.3 },
  { id: featureId('puzzle'), type: GENRE, igdbId: 4, slug: 'puzzle', name: 'Puzzle', idf: 1.4 },
  { id: featureId('indie'), type: GENRE, igdbId: 5, slug: 'indie', name: 'Indie', idf: 0.1 },
  { id: featureId('fantasy'), type: THEME, igdbId: 1, slug: 'fantasy', name: 'Fantasy', idf: 1 },
  { id: featureId('action'), type: THEME, igdbId: 2, slug: 'action', name: 'Action', idf: 0.9 },
  { id: featureId('horror'), type: THEME, igdbId: 3, slug: 'horror', name: 'Horror', idf: 1.6 },
  {
    id: featureId('survival'),
    type: THEME,
    igdbId: 4,
    slug: 'survival',
    name: 'Survival',
    idf: 1.5,
  },
  { id: featureId('sci-fi'), type: THEME, igdbId: 5, slug: 'sci-fi', name: 'Sci-fi', idf: 1.2 },
  FILLER_FEATURE,
];

const SAGA = ['rpg', 'adventure', 'fantasy', 'action', 'indie'];

// saga-1 a saga-6, dread-1 e dread-2 são a biblioteca (TASTE_LIBRARY); os outros, candidatos.
const TASTE_GAMES: FixtureGames = {
  ...Object.fromEntries(
    [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((pop, i) => [`saga-${i + 1}`, [SAGA, pop]]),
  ),
  'dread-1': [['shooter', 'horror', 'survival', 'indie'], 0.4],
  'dread-2': [['puzzle', 'horror', 'indie'], 0.3],
  ...Object.fromEntries(
    [0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.3, 0.1].map((pop, i) => [
      `saga-${String.fromCharCode(97 + i)}`,
      [SAGA, pop],
    ]),
  ),
  'saga-lite': [['rpg', 'fantasy', 'indie'], 0.2],
  'fright-a': [['shooter', 'horror', 'survival', 'indie'], 0.6],
  'fright-b': [['puzzle', 'horror', 'indie'], 0.2],
  'fright-c': [['horror', 'sci-fi', 'indie'], 0.05],
  'saga-fright': [['rpg', 'horror', 'indie'], 0.4],
  'saga-soon': [['rpg', 'adventure', 'fantasy', 'indie'], 0.3, ReleaseStatus.UPCOMING],
  'fright-soon': [['horror', 'survival', 'indie'], 0.1, ReleaseStatus.UPCOMING],
  'space-only': [['sci-fi', 'indie'], 0.5],
  ...fillers('filler', 44, ['filler']),
};

// O caso da conferência no navegador do B-71: Aventura está nos dois gostos e em todo o
// catálogo, e sozinha cobriria a biblioteca inteira. RPG, Fantasia, Tiro e Terror ficam abaixo
// do limite de frequência dos interesses.
const GENERIC_FEATURES: FixtureFeature[] = [
  { id: featureId('rpg'), type: GENRE, igdbId: 1, slug: 'rpg', name: 'RPG', idf: 1 },
  {
    id: featureId('adventure'),
    type: GENRE,
    igdbId: 2,
    slug: 'adventure',
    name: 'Adventure',
    idf: 0.4,
  },
  { id: featureId('shooter'), type: GENRE, igdbId: 3, slug: 'shooter', name: 'Shooter', idf: 1.3 },
  { id: featureId('fantasy'), type: THEME, igdbId: 1, slug: 'fantasy', name: 'Fantasy', idf: 1 },
  { id: featureId('horror'), type: THEME, igdbId: 2, slug: 'horror', name: 'Horror', idf: 1.6 },
];

const QUEST = ['rpg', 'fantasy', 'adventure'];
const SCARE = ['shooter', 'horror', 'adventure'];

const GENERIC_GAMES: FixtureGames = {
  ...Object.fromEntries(
    [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((pop, i) => [`quest-${i + 1}`, [QUEST, pop]]),
  ),
  'scare-1': [SCARE, 0.4],
  'scare-2': [SCARE, 0.3],
  ...Object.fromEntries(
    [0.9, 0.7, 0.5, 0.3].map((pop, i) => [`quest-${String.fromCharCode(97 + i)}`, [QUEST, pop]]),
  ),
  ...Object.fromEntries(
    [0.6, 0.4, 0.2].map((pop, i) => [`scare-${String.fromCharCode(97 + i)}`, [SCARE, pop]]),
  ),
  ...fillers('trail', 15, ['adventure']),
};

export const GENERIC_LIBRARY = [
  ...Array.from({ length: 6 }, (_, i) => `quest-${i + 1}`),
  'scare-1',
  'scare-2',
];

export const TASTE_LIBRARY = [
  ...Array.from({ length: 6 }, (_, i) => `saga-${i + 1}`),
  'dread-1',
  'dread-2',
];

export const scoringConfig: ScoringConfig = readScoringConfig();

function fixtureIndex(
  features: FixtureFeature[],
  games: FixtureGames,
  without: readonly string[],
): ContentIndex {
  const position = new Map(features.map((f, i) => [f.slug, i]));
  return buildContentIndex(
    {
      features,
      games: Object.entries(games)
        .filter(([slug]) => !without.includes(slug))
        .map(([slug, [slugs, popularityNorm, releaseStatus = ReleaseStatus.RELEASED]]) => ({
          id: gameId(slug),
          slug,
          releaseStatus,
          popularityNorm,
          featurePositions: slugs.map((f) => position.get(f)!),
        })),
    },
    readTfidfConfig(),
    new Map(
      features
        .filter((f) => f.type === TAG && f.shelf)
        .map((f) => [
          f.igdbId,
          {
            gameKind: f.gameKind ?? false,
            title: f.title ?? null,
            sameIdeaAs: f.sameIdeaAs ?? null,
          },
        ]),
    ),
  );
}

// Sem alguns jogos, para simular os que saíram do catálogo: o IDF dos atributos não muda.
export function scoringIndex({ without = [] }: { without?: string[] } = {}): ContentIndex {
  return fixtureIndex(FEATURES, GAMES, without);
}

export function tasteIndex(): ContentIndex {
  return fixtureIndex(TASTE_FEATURES, TASTE_GAMES, []);
}

export function genericIndex(): ContentIndex {
  return fixtureIndex(GENERIC_FEATURES, GENERIC_GAMES, []);
}

// O caso da conferência em produção do B-71: depois de RPG, só Amnesia fica sem cobertura, e os
// atributos dele empatam. Terror está em três jogos da biblioteca; Furtividade e Mistério, só em
// Amnesia; Tiro é o mais frequente no catálogo.
const AMNESIA_FEATURES: FixtureFeature[] = [
  { id: featureId('rpg'), type: GENRE, igdbId: 1, slug: 'rpg', name: 'RPG', idf: 1 },
  { id: featureId('puzzle'), type: GENRE, igdbId: 2, slug: 'puzzle', name: 'Puzzle', idf: 1.4 },
  { id: featureId('shooter'), type: GENRE, igdbId: 3, slug: 'shooter', name: 'Shooter', idf: 1.3 },
  { id: featureId('fantasy'), type: THEME, igdbId: 1, slug: 'fantasy', name: 'Fantasy', idf: 1 },
  { id: featureId('horror'), type: THEME, igdbId: 2, slug: 'horror', name: 'Horror', idf: 1.6 },
  { id: featureId('stealth'), type: THEME, igdbId: 3, slug: 'stealth', name: 'Stealth', idf: 2 },
  { id: featureId('mystery'), type: THEME, igdbId: 4, slug: 'mystery', name: 'Mystery', idf: 1.8 },
  FILLER_FEATURE,
];

const AMNESIA_GAMES: FixtureGames = {
  ...Object.fromEntries(
    [0.5, 0.6, 0.7, 0.8, 0.9].map((pop, i) => [`quest-${i + 1}`, [['rpg', 'fantasy'], pop]]),
  ),
  amnesia: [['puzzle', 'shooter', 'horror', 'stealth', 'mystery'], 0.6],
  'seven-days': [['rpg', 'shooter', 'horror'], 0.8],
  undertale: [['rpg', 'puzzle', 'horror'], 0.9],
  ...fillers('gun', 6, ['shooter']),
  ...fillers('filler', 20, ['filler']),
};

export const AMNESIA_LIBRARY = [
  ...Array.from({ length: 5 }, (_, i) => `quest-${i + 1}`),
  'amnesia',
  'seven-days',
  'undertale',
];

export function amnesiaIndex(): ContentIndex {
  return fixtureIndex(AMNESIA_FEATURES, AMNESIA_GAMES, []);
}

export const gameId = (slug: string) => `g-${slug}`;

// Os atributos do jogo como o banco os guarda, para montar o vetor de quem está fora do índice.
export function featuresOf(slug: string): { type: FeatureType; igdbId: number }[] {
  return GAMES[slug]![0].map((feature) => {
    const { type, igdbId } = FEATURES.find((f) => f.slug === feature)!;
    return { type, igdbId };
  });
}

// Os candidatos de scoreCandidates como objetos, para os testes lerem.
export function candidateList(index: ContentIndex, candidates: ScoredCandidates) {
  return Array.from({ length: candidates.count }, (_, k) => ({
    game: index.games[candidates.gamePositions[k]!]!,
    similarity: candidates.similarity[k]!,
    score: candidates.score[k]!,
  }));
}

export function gameOf(index: ContentIndex, slug: string): IndexedGame {
  return index.games[index.positionByGameId.get(gameId(slug))!]!;
}

export function featurePosition(index: ContentIndex, slug: string): number {
  return index.features.findIndex((f) => f.slug === slug);
}

// likedAt: a data da nota ou do favorito, em milissegundos.
export function rated(
  index: ContentIndex,
  slug: string,
  score: number | null,
  lists: ListType[] = [],
  likedAt: number | null = null,
): Interaction {
  return { gameId: gameId(slug), slug, score, lists, vector: gameOf(index, slug), likedAt };
}

// O caso de produção com etiquetas (B-74, refeito com as etiquetas no B-78): o terror de
// sobrevivência é uma etiqueta de subgênero que pode virar prateleira, em scare-1, scare-2, scare-a
// e scare-b.
// Aventura está em todo o catálogo, e Tiro é mais frequente que a etiqueta. rogue-1 só tem a
// etiqueta Roguelike.
const TAGGED_FEATURES: FixtureFeature[] = [
  ...GENERIC_FEATURES,
  {
    id: featureId('survival-horror'),
    type: TAG,
    igdbId: 1,
    slug: 'survival-horror',
    name: 'Terror de Sobrevivência',
    idf: 2,
    shelf: true,
    gameKind: true,
  },
  {
    id: featureId('roguelike'),
    type: TAG,
    igdbId: 2,
    slug: 'roguelike',
    name: 'Roguelike',
    idf: 2,
    shelf: true,
    gameKind: true,
  },
  FILLER_FEATURE,
];

const TAGGED_GAMES: FixtureGames = {
  ...Object.fromEntries(
    [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((pop, i) => [`quest-${i + 1}`, [QUEST, pop]]),
  ),
  'scare-1': [[...SCARE, 'survival-horror'], 0.4],
  'scare-2': [[...SCARE, 'survival-horror'], 0.3],
  'rogue-1': [['roguelike'], 0.5],
  ...Object.fromEntries(
    [0.9, 0.7, 0.5, 0.3].map((pop, i) => [`quest-${String.fromCharCode(97 + i)}`, [QUEST, pop]]),
  ),
  'scare-a': [[...SCARE, 'survival-horror'], 0.6],
  'scare-b': [[...SCARE, 'survival-horror'], 0.2],
  'rogue-a': [['rpg', 'roguelike'], 0.4],
  ...fillers('gun', 6, ['shooter']),
  ...fillers('fright', 3, ['horror']),
  ...fillers('trail', 25, ['adventure']),
  ...fillers('filler', 20, ['filler']),
};

export const TAGGED_LIBRARY = [
  ...Array.from({ length: 6 }, (_, i) => `quest-${i + 1}`),
  'scare-1',
  'scare-2',
];

export function taggedIndex({ without = [] }: { without?: string[] } = {}): ContentIndex {
  return fixtureIndex(TAGGED_FEATURES, TAGGED_GAMES, without);
}

// Os atributos de um jogo como o banco os guarda, para o que saiu do índice.
export function taggedGameOf(slug: string) {
  return {
    features: TAGGED_GAMES[slug]![0].map((feature) => {
      const { type, igdbId } = TAGGED_FEATURES.find((f) => f.slug === feature)!;
      return { type, igdbId };
    }),
  };
}

// A regra de duas fases (B-79). Na biblioteca: três jogos de plataforma (a etiqueta Plataforma, de
// subgênero, tem a mesma ideia do gênero Platform), dois de roguelike, dois de RPG sem etiqueta
// de tipo de jogo e Amnesia, o único de terror. Impiedoso é mecânica, em quatro jogos.
// Metroidvania quase só aparece junto com Plataforma no catálogo.
const tag = (igdbId: number, slug: string, name: string, extra: Partial<FixtureFeature> = {}) => ({
  id: featureId(slug),
  type: TAG,
  igdbId,
  slug,
  name,
  idf: 2,
  shelf: true,
  ...extra,
});

const SHELF_FEATURES: FixtureFeature[] = [
  { id: featureId('rpg'), type: GENRE, igdbId: 1, slug: 'rpg', name: 'RPG', idf: 1 },
  {
    id: featureId('platform'),
    type: GENRE,
    igdbId: 2,
    slug: 'platform',
    name: 'Platform',
    idf: 1,
  },
  { id: featureId('fantasy'), type: THEME, igdbId: 1, slug: 'fantasy', name: 'Fantasy', idf: 1 },
  { id: featureId('horror'), type: THEME, igdbId: 2, slug: 'horror', name: 'Horror', idf: 1.6 },
  tag(1, 'platformer', 'Plataforma', { gameKind: true, sameIdeaAs: 'genre:platform' }),
  tag(2, 'roguelike', 'Roguelike', { gameKind: true, title: 'roguelikes e roguelites' }),
  tag(3, 'metroidvania', 'Metroidvania', { gameKind: true }),
  tag(4, 'survival-horror', 'Terror de Sobrevivência', { gameKind: true }),
  tag(5, 'difficult', 'Impiedoso', { title: 'jogos difíceis' }),
  tag(6, 'rpg-tag', 'RPG', { sameIdeaAs: 'genre:rpg' }),
  tag(7, 'pixel-art', 'Pixel Art', { shelf: false }),
  FILLER_FEATURE,
];

const SHELF_GAMES: FixtureGames = {
  hollow: [['platform', 'fantasy', 'platformer', 'metroidvania', 'difficult', 'pixel-art'], 0.9],
  dead: [['platform', 'fantasy', 'platformer', 'metroidvania', 'roguelike', 'difficult'], 0.8],
  hades: [['fantasy', 'roguelike', 'difficult'], 0.9],
  celeste: [['platform', 'platformer', 'difficult', 'pixel-art'], 0.8],
  amnesia: [['horror', 'survival-horror'], 0.6],
  'tale-1': [['rpg', 'rpg-tag'], 0.5],
  'tale-2': [['rpg', 'rpg-tag'], 0.4],
  'metro-a': [['platform', 'platformer', 'metroidvania'], 0.5],
  'metro-b': [['platform', 'platformer', 'metroidvania', 'pixel-art'], 0.3],
  'plat-a': [['platform', 'platformer'], 0.4],
  'rogue-a': [['fantasy', 'roguelike'], 0.5],
  'hard-a': [['difficult'], 0.2],
  'hard-b': [['difficult'], 0.1],
  'tale-a': [['rpg', 'fantasy', 'rpg-tag'], 0.6],
  'fright-a': [['horror', 'survival-horror'], 0.3],
  ...fillers('filler', 65, ['filler']),
};

export const SHELF_LIBRARY = ['hollow', 'dead', 'hades', 'celeste', 'amnesia', 'tale-1', 'tale-2'];

export function shelfIndex(): ContentIndex {
  return fixtureIndex(SHELF_FEATURES, SHELF_GAMES, []);
}
