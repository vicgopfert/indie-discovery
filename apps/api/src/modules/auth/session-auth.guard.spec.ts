import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import type { User } from '../../generated/prisma/client';
import { SessionAuthGuard } from './session-auth.guard';
import { hashSessionToken } from './session-token';
import type { SessionsRepository } from './sessions.repository';

const user = { id: 'id-1', email: 'jogadora@example.com' } as User;

function contextWith(cookies: Record<string, string> | undefined, isPublic = false) {
  const request: { cookies: Record<string, string> | undefined; user?: User } = { cookies };
  const handler = () => undefined;
  if (isPublic) Reflect.defineMetadata(IS_PUBLIC, true, handler);
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('SessionAuthGuard', () => {
  const validHash = hashSessionToken('token-valido');
  const sessions = {
    findUserOfValidSession: (tokenHash: string) =>
      Promise.resolve(tokenHash === validHash ? user : null),
  } as unknown as SessionsRepository;
  const guard = new SessionAuthGuard(new Reflector(), sessions);

  it('libera a rota pública sem cookie', async () => {
    await expect(guard.canActivate(contextWith(undefined, true).context)).resolves.toBe(true);
  });

  it('anexa o usuário da sessão válida à requisição', async () => {
    const { context, request } = contextWith({ sid: 'token-valido' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(user);
  });

  it.each([
    ['sem cookie', undefined],
    ['com token desconhecido ou expirado', { sid: 'outro-token' }],
  ])('responde 401 %s', async (_, cookies) => {
    await expect(guard.canActivate(contextWith(cookies).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
