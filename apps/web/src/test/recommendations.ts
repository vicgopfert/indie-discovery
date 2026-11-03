import type { Recommendation, RecommendationOverview } from '@indie/contracts';
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

// items vira a lista principal; a página ainda não mostra as prateleiras (B-72).
export const sampleRecommendationOverview = ({
  items = [sampleRecommendation()],
  ...overrides
}: Partial<Omit<RecommendationOverview, 'main'>> & {
  items?: Recommendation[];
} = {}): RecommendationOverview => ({
  mode: 'BALANCED',
  basis: 'profile',
  main: { items, hasMore: false },
  shelves: [],
  ...overrides,
});
