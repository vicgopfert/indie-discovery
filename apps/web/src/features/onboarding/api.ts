import {
  OnboardingGamesSchema,
  PreferenceOptionsSchema,
  type PreferencesInput,
  PreferencesSchema,
} from '@indie/contracts';
import { apiFetch } from '@/lib/api-client';

export const getPreferenceOptions = () =>
  apiFetch('/me/preferences/options', { schema: PreferenceOptionsSchema });

export const getPreferences = () => apiFetch('/me/preferences', { schema: PreferencesSchema });

export const savePreferences = (input: PreferencesInput) =>
  apiFetch('/me/preferences', { method: 'PUT', body: input, schema: PreferencesSchema });

export const getOnboardingGames = () =>
  apiFetch('/me/onboarding/games', { schema: OnboardingGamesSchema });
