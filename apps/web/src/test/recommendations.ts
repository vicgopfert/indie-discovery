import type { Recommendation, RecommendationList } from '@indie/contracts';
import { sampleGame } from './catalog';

export const sampleRecommendation = (overrides: Partial<Recommendation> = {}): Recommendation => ({
  game: sampleGame(),
  reason: {
    kind: 'features',
    features: [
      { slug: 'platform', name: 'Plataforma' },
      { slug: 'fantasy', name: 'Fantasia' },
    ],
  },
  lowKnown: false,
  ...overrides,
});

export const sampleRecommendationList = (
  overrides: Partial<RecommendationList> = {},
): RecommendationList => ({
  mode: 'BALANCED',
  basis: 'profile',
  items: [sampleRecommendation()],
  ...overrides,
});
