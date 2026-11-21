import type { User } from '@indie/contracts';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmEmail,
  getSession,
  login,
  logout,
  register,
  requestEmailConfirmation,
  requestPasswordReset,
  resetPassword,
} from './api';

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

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: logout, onSuccess: () => clearAccount(queryClient) });
}

export const useRequestPasswordReset = () => useMutation({ mutationFn: requestPasswordReset });

// A redefinição encerra todas as sessões da conta, inclusive a deste navegador, se houver.
export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: resetPassword, onSuccess: () => clearAccount(queryClient) });
}

export const useRequestEmailConfirmation = () =>
  useMutation({ mutationFn: requestEmailConfirmation });

// Se a conta confirmada estiver aberta neste navegador, a sessão recarregada tira o aviso.
export function useConfirmEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmEmail,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  });
}

// Ao sair, ou quando a sessão vence: o que estiver no cache pertence à conta que saiu.
export function clearAccount(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] });
  queryClient.setQueryData(SESSION_QUERY_KEY, null);
}
