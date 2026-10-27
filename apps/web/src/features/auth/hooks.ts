import type { User } from '@indie/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, login, logout, register } from './api';

export const SESSION_QUERY_KEY = ['session'] as const;

export function useSession() {
  return useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: getSession });
}

export const useLogin = () => useSignIn(login);
export const useRegister = () => useSignIn(register);

// A resposta já traz o usuário: grava direto no cache, sem pedir /me de novo.
function useSignIn<TInput>(mutationFn: (input: TInput) => Promise<User>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => queryClient.setQueryData(SESSION_QUERY_KEY, user),
  });
}

// O que estiver no cache pertence à conta que saiu.
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
      });
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}
