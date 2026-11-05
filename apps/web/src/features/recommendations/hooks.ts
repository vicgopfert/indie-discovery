import type { DiscoveryMode } from '@indie/contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearAccount, SESSION_QUERY_KEY } from '@/features/auth/hooks';
import { isUnauthorized } from '@/lib/api-client';
import { getRecommendationOverview, saveDiscoveryMode } from './api';

// A ficha do jogo invalida esta chave, que cobre a visão geral e o "ver mais": o que o jogador
// muda lá vale nas próximas listas.
export const RECOMMENDATIONS_QUERY_KEY = ['recommendations'] as const;

export function useRecommendationOverview(mode: DiscoveryMode) {
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'overview', mode],
    queryFn: () => getRecommendationOverview(mode),
    // Ao trocar o modo, a lista anterior fica na tela até a nova chegar.
    placeholderData: keepPreviousData,
  });
}

// O modo da lista é o da sessão: gravado o modo, a lista do modo novo é pedida em seguida.
export function useSaveDiscoveryMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveDiscoveryMode,
    onSuccess: (user) => queryClient.setQueryData(SESSION_QUERY_KEY, user),
    onError: (error) => {
      if (isUnauthorized(error)) clearAccount(queryClient);
    },
  });
}
