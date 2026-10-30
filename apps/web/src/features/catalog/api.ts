import {
  CountryOptionSchema,
  FeatureOptionSchema,
  type FeatureQuery,
  GamePageSchema,
  type GameSearchQuery,
} from '@indie/contracts';
import { apiFetch } from '@/lib/api-client';
import { toSearchParams } from './search-params';

export const searchGames = (query: GameSearchQuery) =>
  apiFetch(`/games?${toSearchParams(query).toString()}`, { schema: GamePageSchema });

export const listFeatures = (type: FeatureQuery['type']) =>
  apiFetch(`/features?type=${type}`, { schema: FeatureOptionSchema.array() });

export const listCountries = () => apiFetch('/countries', { schema: CountryOptionSchema.array() });
