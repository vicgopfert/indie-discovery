import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';

export interface AuthenticatedRequest extends Request {
  user: User;
}

// O usuário vem sempre da sessão, nunca de parâmetro ou corpo da requisição.
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
