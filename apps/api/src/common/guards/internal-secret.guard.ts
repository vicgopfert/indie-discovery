import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ApiEnv } from '../../config/env';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Rotas internas recebem "Authorization: Bearer <INTERNAL_RELOAD_SECRET>". Os hashes têm o mesmo
// tamanho, e a comparação em tempo constante não revela quantos caracteres batem.
@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly secret: Buffer;

  constructor(env: ConfigService<ApiEnv, true>) {
    this.secret = digest(env.get('INTERNAL_RELOAD_SECRET', { infer: true }));
  }

  canActivate(context: ExecutionContext) {
    const header = context.switchToHttp().getRequest<Request>().get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (token && timingSafeEqual(digest(token), this.secret)) return true;
    throw new UnauthorizedException('Segredo interno inválido');
  }
}
