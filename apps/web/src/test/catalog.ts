import type { GameSummary } from '@indie/contracts';

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
