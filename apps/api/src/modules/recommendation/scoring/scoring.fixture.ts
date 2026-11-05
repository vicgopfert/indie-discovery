import { FeatureType, type ListType, ReleaseStatus } from '../../../generated/prisma/client';
import { buildContentIndex, type ContentIndex, type IndexedGame } from '../content-index';
import type { CuratedStyle } from '../../styles/styles';
import { readTfidfConfig } from '../tfidf';
import type { Interaction } from './profile';
import { readScoringConfig, type ScoringConfig } from './scoring-config';

const { GENRE, THEME, KEYWORD } = FeatureType;

export const featureId = (slug: string) => `f-${slug}`;

const FILLER_FEATURE = {
  id: featureId('filler'),
  type: KEYWORD,
  igdbId: 99,
  slug: 'filler',
  name: 'filler',
  idf: 0.5,
};

// Na mesma ordem do repositório: tipo e igdbId.
export const FEATURES = [
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
    type: KEYWORD,
    igdbId: 1,
    slug: 'pixel-art',
    name: 'pixel art',
    idf: 1.1,
  },
  {
    id: featureId('rock-climbing'),
    type: KEYWORD,
    igdbId: 2,
    slug: 'rock-climbing',
    name: 'rock climbing',
    idf: 3,
  },
  FILLER_FEATURE,
];

type FixtureFeature = (typeof FEATURES)[number];

// [atributos, popularidade normalizada, situação (lançado se omitida), resumo]
type FixtureGames = Record<string, [string[], number, ReleaseStatus?, string?]>;

// No catálogo real, cada gênero ou tema está numa fração pequena dos jogos; num fixture de uma
// dúzia, quase todos passariam do limite de frequência dos interesses. Os jogos de enchimento só
// têm uma palavra-chave própria: não mudam os vetores dos outros nem viram candidatos.
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
  styles: readonly CuratedStyle[] = [],
): ContentIndex {
  const position = new Map(features.map((f, i) => [f.slug, i]));
  const isKeyword = new Set(features.filter((f) => f.type === KEYWORD).map((f) => f.slug));
  return buildContentIndex(
    {
      features,
      games: Object.entries(games)
        .filter(([slug]) => !without.includes(slug))
        .map(
          ([slug, [slugs, popularityNorm, releaseStatus = ReleaseStatus.RELEASED, summary]]) => ({
            id: gameId(slug),
            slug,
            releaseStatus,
            popularityNorm,
            featurePositions: slugs.map((f) => position.get(f)!),
            summary: summary ?? '',
            styleKeywords: slugs.filter((f) => isKeyword.has(f)),
          }),
        ),
    },
    readTfidfConfig(),
    styles,
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
export function featuresOf(slug: string): { type: FeatureType; igdbId: number; slug: string }[] {
  return GAMES[slug]![0].map((feature) => {
    const { type, igdbId } = FEATURES.find((f) => f.slug === feature)!;
    return { type, igdbId, slug: feature };
  });
}

export function gameOf(index: ContentIndex, slug: string): IndexedGame {
  return index.games[index.positionByGameId.get(gameId(slug))!]!;
}

export function featurePosition(index: ContentIndex, slug: string): number {
  return index.features.findIndex((f) => f.slug === slug);
}

export function rated(
  index: ContentIndex,
  slug: string,
  score: number | null,
  lists: ListType[] = [],
): Interaction {
  const game = gameOf(index, slug);
  return { gameId: gameId(slug), score, lists, vector: game, styles: game.styles };
}

// O caso de produção com estilos (B-74): o terror de sobrevivência é um estilo, pela palavra-chave
// em scare-1 e scare-a e só pelo resumo em scare-2 e scare-b. Aventura está em todo o catálogo, e
// Tiro é mais frequente que o estilo. rogue-1 só tem a palavra-chave do Roguelike.
export const STYLES: CuratedStyle[] = [
  {
    slug: 'survival-horror',
    name: 'Terror de sobrevivência',
    category: 'tone',
    keywords: ['survival-horror'],
    summaryTerms: ['survival horror'],
  },
  {
    slug: 'roguelike',
    name: 'Roguelike',
    category: 'gameplay',
    keywords: ['roguelite'],
    summaryTerms: ['roguelike'],
  },
];

const STYLED_FEATURES: FixtureFeature[] = [
  ...GENERIC_FEATURES,
  {
    id: featureId('survival-horror'),
    type: KEYWORD,
    igdbId: 1,
    slug: 'survival-horror',
    name: 'survival horror',
    idf: 2,
  },
  {
    id: featureId('roguelite'),
    type: KEYWORD,
    igdbId: 2,
    slug: 'roguelite',
    name: 'roguelite',
    idf: 2,
  },
  FILLER_FEATURE,
];

const STYLED_GAMES: FixtureGames = {
  ...Object.fromEntries(
    [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((pop, i) => [`quest-${i + 1}`, [QUEST, pop]]),
  ),
  'scare-1': [[...SCARE, 'survival-horror'], 0.4],
  'scare-2': [SCARE, 0.3, ReleaseStatus.RELEASED, 'A survival horror classic.'],
  'rogue-1': [['roguelite'], 0.5],
  ...Object.fromEntries(
    [0.9, 0.7, 0.5, 0.3].map((pop, i) => [`quest-${String.fromCharCode(97 + i)}`, [QUEST, pop]]),
  ),
  'scare-a': [[...SCARE, 'survival-horror'], 0.6],
  'scare-b': [SCARE, 0.2, ReleaseStatus.RELEASED, 'Survival horror in the dark.'],
  'rogue-a': [['rpg', 'roguelite'], 0.4],
  ...fillers('gun', 6, ['shooter']),
  ...fillers('fright', 3, ['horror']),
  ...fillers('trail', 25, ['adventure']),
  ...fillers('filler', 20, ['filler']),
};

export const STYLED_LIBRARY = [
  ...Array.from({ length: 6 }, (_, i) => `quest-${i + 1}`),
  'scare-1',
  'scare-2',
];

export function styledIndex({ without = [] }: { without?: string[] } = {}): ContentIndex {
  return fixtureIndex(STYLED_FEATURES, STYLED_GAMES, without, STYLES);
}

// Um jogo do catálogo com estilos como o banco o guarda, para o que saiu do índice.
export function styledGameOf(slug: string) {
  const [features, , , summary = ''] = STYLED_GAMES[slug]!;
  return {
    summary,
    features: features.map((feature) => {
      const { type, igdbId } = STYLED_FEATURES.find((f) => f.slug === feature)!;
      return { type, igdbId, slug: feature };
    }),
  };
}
