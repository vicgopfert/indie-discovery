import type { GameDetail, GameSummary } from '@indie/contracts';

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
  developers: ['Extremely OK Games'],
  publishers: ['Maddy Makes Games'],
  studioCountry: { code: 'CA', name: 'Canadá', source: 'IGDB' },
  languages: [
    { locale: 'en-US', name: 'Inglês', interface: true, subtitles: true, audio: false },
    { locale: 'pt-BR', name: 'Português (Brasil)', interface: true, subtitles: true, audio: false },
  ],
  officialUrl: 'https://www.celestegame.com',
  ...overrides,
});
