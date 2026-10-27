import { hours, minutes } from '@nestjs/throttler';

export const AUTH_THROTTLER = 'auth';

// Por IP. No login, freia a força bruta de senhas; no cadastro, a criação de contas em massa e a
// sondagem de e-mails cadastrados pelo 409.
export const LOGIN_LIMIT = { limit: 5, ttl: minutes(1) };
export const REGISTER_LIMIT = { limit: 5, ttl: hours(1) };

export const TOO_MANY_ATTEMPTS_MESSAGE = 'Muitas tentativas; aguarde um pouco e tente de novo';
