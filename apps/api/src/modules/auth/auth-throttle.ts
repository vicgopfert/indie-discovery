import { hours, minutes } from '@nestjs/throttler';

export const IP_THROTTLER = 'ip';
export const ACCOUNT_THROTTLER = 'account';

// Por IP. No login, freia a força bruta de senhas; no cadastro, a criação de contas em massa e a
// sondagem de e-mails cadastrados pelo 409.
export const LOGIN_LIMIT = { limit: 5, ttl: minutes(1) };
export const REGISTER_LIMIT = { limit: 5, ttl: hours(1) };

// Por conta, no login, no pedido de redefinição e no reenvio da confirmação. O IP repassado pela
// Vercel pode ser forjado em parte das requisições; este limite protege cada conta sem depender
// da infraestrutura.
export const ACCOUNT_LOGIN_LIMIT = { limit: 10, ttl: minutes(15) };

// Redefinição de senha. O pedido freia o envio de e-mails em massa, por IP e para o mesmo
// endereço; a confirmação, a tentativa de tokens, como no login.
export const RESET_REQUEST_LIMIT = { limit: 5, ttl: hours(1) };
export const ACCOUNT_RESET_REQUEST_LIMIT = { limit: 3, ttl: hours(1) };
export const RESET_CONFIRM_LIMIT = LOGIN_LIMIT;

// Confirmação do e-mail: o reenvio, com sessão, segue os números do pedido de redefinição.
export const CONFIRMATION_REQUEST_LIMIT = RESET_REQUEST_LIMIT;
export const ACCOUNT_CONFIRMATION_REQUEST_LIMIT = ACCOUNT_RESET_REQUEST_LIMIT;
export const CONFIRMATION_CONFIRM_LIMIT = LOGIN_LIMIT;

export const TOO_MANY_ATTEMPTS_MESSAGE = 'Muitas tentativas; aguarde um pouco e tente de novo';

// Nas rotas com sessão, a conta é a da sessão, que o guard global já carregou. Nas públicas, o
// throttler roda antes da validação: o e-mail é normalizado aqui como no EmailSchema.
export function accountTracker(request: { body?: { email?: unknown }; user?: { id: string } }) {
  if (request.user) return `user:${request.user.id}`;
  const email = request.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
