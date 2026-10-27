import { hours, minutes } from '@nestjs/throttler';

export const IP_THROTTLER = 'ip';
export const ACCOUNT_THROTTLER = 'account';

// Por IP. No login, freia a força bruta de senhas; no cadastro, a criação de contas em massa e a
// sondagem de e-mails cadastrados pelo 409.
export const LOGIN_LIMIT = { limit: 5, ttl: minutes(1) };
export const REGISTER_LIMIT = { limit: 5, ttl: hours(1) };

// Por conta, só no login. O IP repassado pela Vercel pode ser forjado em parte das requisições;
// este limite protege cada conta sem depender da infraestrutura.
export const ACCOUNT_LOGIN_LIMIT = { limit: 10, ttl: minutes(15) };

export const TOO_MANY_ATTEMPTS_MESSAGE = 'Muitas tentativas; aguarde um pouco e tente de novo';

// O throttler roda antes da validação: o e-mail é normalizado aqui como no LoginSchema.
export function accountTracker(request: { body?: { email?: unknown } }) {
  const email = request.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
