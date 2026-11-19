import { createHash, randomBytes } from 'node:crypto';

// O token vai só para quem o usa (cookie ou link); o banco guarda o SHA-256 dele, então um
// vazamento do banco não entrega sessões nem links válidos.
export function newSecretToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSecretToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
