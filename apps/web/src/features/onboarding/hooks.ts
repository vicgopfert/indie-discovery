import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearAccount, SESSION_QUERY_KEY } from '@/features/auth/hooks';
import { RECOMMENDATIONS_QUERY_KEY } from '@/features/recommendations/hooks';
import { isUnauthorized } from '@/lib/api-client';
import { getOnboardingGames, getPreferenceOptions, getPreferences, savePreferences } from './api';

const PREFERENCES_QUERY_KEY = ['preferences'] as const;
const ONBOARDING_GAMES_QUERY_KEY = ['onboarding-games'] as const;

export function usePreferenceOptions() {
  return useQuery({
    queryKey: [...PREFERENCES_QUERY_KEY, 'options'],
    queryFn: getPreferenceOptions,
  });
}

export function usePreferences() {
  return useQuery({ queryKey: [...PREFERENCES_QUERY_KEY, 'mine'], queryFn: getPreferences });
}

// Os jogos saem da biblioteca conforme são avaliados: a lista fica como chegou até as preferências
// mudarem, para o jogo avaliado não sumir da tela.
export function useOnboardingGames() {
  return useQuery({
    queryKey: ONBOARDING_GAMES_QUERY_KEY,
    queryFn: getOnboardingGames,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

// A primeira gravação conclui a partida a frio: a sessão é pedida de novo. As recomendações
// guardadas são descartadas, como ao avaliar na ficha.
export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData([...PREFERENCES_QUERY_KEY, 'mine'], preferences);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.resetQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY });
      void queryClient.resetQueries({ queryKey: ONBOARDING_GAMES_QUERY_KEY });
    },
    onError: (error) => {
      if (isUnauthorized(error)) clearAccount(queryClient);
    },
  });
}
