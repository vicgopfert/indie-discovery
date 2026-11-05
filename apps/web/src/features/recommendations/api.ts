import {
  type DiscoveryMode,
  MODE_PARAMS,
  RecommendationOverviewSchema,
  RecommendationPageSchema,
  UserSchema,
} from '@indie/contracts';
import { apiFetch } from '@/lib/api-client';

// Na URL o modo vai em minúsculas (popular, balanced, discovery).
const MODE_QUERY = Object.fromEntries(
  Object.entries(MODE_PARAMS).map(([param, mode]) => [mode, param]),
) as Record<DiscoveryMode, keyof typeof MODE_PARAMS>;

// O modo vai sempre na consulta: sem ele, a API usaria o salvo, que pode ainda não ser o escolhido.
export const getRecommendationOverview = (mode: DiscoveryMode) =>
  apiFetch(`/recommendations?mode=${MODE_QUERY[mode]}`, { schema: RecommendationOverviewSchema });

export const getRecommendationPage = (key: string, mode: DiscoveryMode, page: number) =>
  apiFetch(
    `/recommendations/lists/${encodeURIComponent(key)}?mode=${MODE_QUERY[mode]}&page=${page}`,
    { schema: RecommendationPageSchema },
  );

export const saveDiscoveryMode = (discoveryMode: DiscoveryMode) =>
  apiFetch('/me', { method: 'PATCH', body: { discoveryMode }, schema: UserSchema });
