import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'sid';

// O token vai só no cookie; o banco guarda o SHA-256 dele, então um vazamento do banco não
// entrega sessões válidas.
export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
