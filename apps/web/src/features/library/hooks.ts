import type { GameLibraryState } from '@indie/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api-client';
import { clearAccount } from '@/features/auth/hooks';
import { applyLibraryAction, getGameLibrary, type LibraryAction } from './api';

export const LIBRARY_QUERY_KEY = ['library'] as const;
// A página de recomendações (B-35) usa esta chave: o que o jogador muda aqui vale na próxima lista.
export const RECOMMENDATIONS_QUERY_KEY = ['recommendations'] as const;

const gameKey = (slug: string) => [...LIBRARY_QUERY_KEY, slug] as const;

export const isUnauthorized = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 401;

export function useGameLibrary(slug: string) {
  return useQuery({ queryKey: gameKey(slug), queryFn: () => getGameLibrary(slug) });
}

// Sem atualização otimista: o que aparece marcado é o que a API gravou.
export function useLibraryAction(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: LibraryAction) =>
      applyLibraryAction(slug, action, queryClient.getQueryData<GameLibraryState>(gameKey(slug))!),
    // Sem esperar as outras listas recarregarem: a ficha já mostra o que foi gravado.
    onSuccess: (state) => {
      queryClient.setQueryData(gameKey(slug), state);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY, exact: true });
      void queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY });
    },
    onError: (error) => {
      if (isUnauthorized(error)) clearAccount(queryClient);
    },
  });
}
