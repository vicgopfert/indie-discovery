import type {
  CollectionDetail,
  CollectionSummary,
  GameDetail,
  GameSummary,
} from '@indie/contracts';

export const sampleGame = (overrides: Partial<GameSummary> = {}): GameSummary => ({
  slug: 'celeste',
  name: 'Celeste',
  coverImageId: 'co3byy',
  releaseStatus: 'RELEASED',
  firstReleaseDate: '2018-01-25',
  genres: [
    { slug: 'adventure', name: 'Aventura' },
    { slug: 'platform', name: 'Plataforma' },
  ],
  ...overrides,
});

export const sampleGameDetail = (overrides: Partial<GameDetail> = {}): GameDetail => ({
  ...sampleGame(),
  summary: 'Ajude Madeline a escalar a montanha Celeste.',
  themes: [{ slug: 'action', name: 'Ação' }],
  tags: [
    { slug: 'precision-platformer', name: 'Plataforma de Precisão' },
    { slug: 'difficult', name: 'Difícil' },
  ],
  tagSource: 'STEAM',
  steamAppId: 504230,
  developers: ['Extremely OK Games'],
  publishers: ['Maddy Makes Games'],
  studioCountry: { code: 'CA', name: 'Canadá', source: 'IGDB' },
  languages: [
    { locale: 'en-US', name: 'Inglês', interface: true, subtitles: true, audio: false },
    { locale: 'pt-BR', name: 'Português (Brasil)', interface: true, subtitles: true, audio: false },
  ],
  officialUrl: 'https://www.celestegame.com',
  collections: [],
  ...overrides,
});

export const sampleCollection = (
  overrides: Partial<CollectionSummary> = {},
): CollectionSummary => ({
  slug: 'brasil',
  name: 'Brasil',
  description: 'Folclore, povos originários, história e cotidiano do Brasil.',
  gameCount: 29,
  coverImageIds: ['co1aaa', 'co1bbb'],
  ...overrides,
});

export const sampleCollectionDetail = (
  games: GameSummary[] = [sampleGame()],
  { page = 1, total = games.length, pageSize = 24 } = {},
): CollectionDetail => ({
  slug: 'brasil',
  name: 'Brasil',
  description: 'Folclore, povos originários, história e cotidiano do Brasil.',
  games: { items: games, page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});
