import type { Recommendation, RecommendationOverview, RecommendationPage } from '@indie/contracts';
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

// items vira a lista principal, sem "ver mais"; main a substitui inteira.
export const sampleRecommendationOverview = ({
  items = [sampleRecommendation()],
  ...overrides
}: Partial<RecommendationOverview> & {
  items?: Recommendation[];
} = {}): RecommendationOverview => ({
  mode: 'BALANCED',
  basis: 'profile',
  main: { items, hasMore: false },
  shelves: [],
  ...overrides,
});

export const sampleRecommendationPage = (
  overrides: Partial<RecommendationPage> = {},
): RecommendationPage => ({
  mode: 'BALANCED',
  basis: 'profile',
  key: 'theme:horror',
  feature: { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' },
  game: null,
  page: 1,
  items: [sampleRecommendation()],
  hasMore: false,
  ...overrides,
});
