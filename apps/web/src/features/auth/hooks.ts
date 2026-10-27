import type { User } from '@indie/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, login, register } from './api';

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
