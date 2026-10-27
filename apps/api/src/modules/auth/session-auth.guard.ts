import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import { hashSessionToken, SESSION_COOKIE } from './session-token';
import { SessionsRepository } from './sessions.repository';

// Registrado como guard global: uma rota nova esquecida fica fechada, não aberta.
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    const user =
      typeof token === 'string'
        ? await this.sessions.findUserOfValidSession(hashSessionToken(token), new Date())
        : null;
    if (!user) throw new UnauthorizedException('Sessão ausente ou expirada');
    request.user = user;
    return true;
  }
}
