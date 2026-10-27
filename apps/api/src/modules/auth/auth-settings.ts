import type { CookieOptions } from 'express';

export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');

export interface AuthSettings {
  sessionTtlDays: number;
  secureCookie: boolean;
}

const DAY_MS = 86_400_000;

export function sessionExpiresAt(settings: AuthSettings, now: Date) {
  return new Date(now.getTime() + settings.sessionTtlDays * DAY_MS);
}

// HttpOnly tira o cookie do alcance do JavaScript; SameSite=Lax impede o envio em POST vindo de
// outro site; Secure só em produção, porque o ambiente local é HTTP.
export function sessionCookieOptions(settings: AuthSettings): CookieOptions {
  return {
    httpOnly: true,
    secure: settings.secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: settings.sessionTtlDays * DAY_MS,
  };
}
