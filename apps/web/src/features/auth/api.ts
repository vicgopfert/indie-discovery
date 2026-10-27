import { type LoginInput, type RegisterInput, type User, UserSchema } from '@indie/contracts';
import { ApiRequestError, apiFetch } from '@/lib/api-client';

// Sem sessão não é erro: o visitante só não entrou.
export async function getSession(): Promise<User | null> {
  try {
    return await apiFetch('/auth/me', { schema: UserSchema });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}

export const login = (input: LoginInput) =>
  apiFetch('/auth/login', { method: 'POST', body: input, schema: UserSchema });

export const register = (input: RegisterInput) =>
  apiFetch('/auth/register', { method: 'POST', body: input, schema: UserSchema });
