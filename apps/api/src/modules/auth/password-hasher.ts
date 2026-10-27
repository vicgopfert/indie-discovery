import { Injectable } from '@nestjs/common';
import { argon2id, hash, type HashOptions, verify } from 'argon2';

// Configuração mínima recomendada pela OWASP para o Argon2id: 19 MiB, 2 iterações, paralelismo 1.
const OWASP_ARGON2ID: HashOptions = {
  type: argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordHasher {
  hash(password: string) {
    return hash(password, OWASP_ARGON2ID);
  }

  verify(passwordHash: string, password: string) {
    return verify(passwordHash, password);
  }
}
