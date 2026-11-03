import { FeatureType, type ListType, ReleaseStatus } from '../../../generated/prisma/client';
import { buildContentIndex, type ContentIndex, type IndexedGame } from '../content-index';
import { readTfidfConfig } from '../tfidf';
import type { Interaction } from './profile';
import { readScoringConfig, type ScoringConfig } from './scoring-config';

const { GENRE, THEME, KEYWORD } = FeatureType;

export const featureId = (slug: string) => `f-${slug}`;

// Na mesma ordem do repositório: tipo e igdbId.
const FEATURES = [
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
];

// [atributos, popularidade normalizada]
const GAMES: Record<string, [string[], number]> = {
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
};

export const scoringConfig: ScoringConfig = readScoringConfig();

// Sem alguns jogos, para simular os que saíram do catálogo: o IDF dos atributos não muda.
export function scoringIndex({ without = [] }: { without?: string[] } = {}): ContentIndex {
  const position = new Map(FEATURES.map((f, i) => [f.slug, i]));
  return buildContentIndex(
    {
      features: FEATURES,
      games: Object.entries(GAMES)
        .filter(([slug]) => !without.includes(slug))
        .map(([slug, [features, popularityNorm]]) => ({
          id: gameId(slug),
          slug,
          releaseStatus: ReleaseStatus.RELEASED,
          popularityNorm,
          featurePositions: features.map((f) => position.get(f)!),
        })),
    },
    readTfidfConfig(),
  );
}

export const gameId = (slug: string) => `g-${slug}`;

// Os atributos do jogo como o banco os guarda, para montar o vetor de quem está fora do índice.
export function featuresOf(slug: string): { type: FeatureType; igdbId: number }[] {
  return GAMES[slug]![0].map((feature) => {
    const { type, igdbId } = FEATURES.find((f) => f.slug === feature)!;
    return { type, igdbId };
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
  return { gameId: gameId(slug), score, lists, vector: gameOf(index, slug) };
}
