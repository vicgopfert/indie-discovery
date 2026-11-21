import {
  type EmailConfirmationInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  type RegisterInput,
  type User,
  UserSchema,
} from '@indie/contracts';
import { apiFetch, isUnauthorized } from '@/lib/api-client';

// Sem sessão não é erro: o visitante só não entrou.
export async function getSession(): Promise<User | null> {
  try {
    return await apiFetch('/auth/me', { schema: UserSchema });
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export const login = (input: LoginInput) =>
  apiFetch('/auth/login', { method: 'POST', body: input, schema: UserSchema });

export const register = (input: RegisterInput) =>
  apiFetch('/auth/register', { method: 'POST', body: input, schema: UserSchema });

export const requestPasswordReset = (input: PasswordResetRequestInput) =>
  apiFetch('/auth/password-reset/request', { method: 'POST', body: input });

export const resetPassword = (input: PasswordResetConfirmInput) =>
  apiFetch('/auth/password-reset/confirm', { method: 'POST', body: input });

export const requestEmailConfirmation = () =>
  apiFetch('/auth/email-confirmation/request', { method: 'POST' });

export const confirmEmail = (input: EmailConfirmationInput) =>
  apiFetch('/auth/email-confirmation/confirm', { method: 'POST', body: input });

// Uma sessão que já venceu também termina sem sessão: o 401 aqui não é falha.
export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }
}
