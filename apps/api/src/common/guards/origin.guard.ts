import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ApiEnv } from '../../config/env';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Reforça o SameSite=Lax contra CSRF: o que altera dados só vale vindo do próprio frontend.
// Sem Origin também é recusado, porque navegadores sempre o enviam nesses métodos.
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(env: ConfigService<ApiEnv, true>) {
    this.allowedOrigin = new URL(env.get('WEB_ORIGIN', { infer: true })).origin;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!STATE_CHANGING_METHODS.has(request.method)) return true;
    if (request.get('origin') === this.allowedOrigin) return true;
    throw new ForbiddenException('Origem da requisição não permitida');
  }
}
