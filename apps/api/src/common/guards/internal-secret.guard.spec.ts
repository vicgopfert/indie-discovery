import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../../config/env';
import { InternalSecretGuard } from './internal-secret.guard';

const SECRET = 'segredo-interno-com-pelo-menos-32-caracteres';

function contextWith(authorization?: string) {
  const request = { get: (name: string) => (name === 'authorization' ? authorization : undefined) };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('InternalSecretGuard', () => {
  const env = { get: () => SECRET } as unknown as ConfigService<ApiEnv, true>;
  const guard = new InternalSecretGuard(env);

  it('libera com o segredo no cabeçalho Authorization', () => {
    expect(guard.canActivate(contextWith(`Bearer ${SECRET}`))).toBe(true);
  });

  it.each([
    ['sem cabeçalho', undefined],
    ['com o segredo errado', 'Bearer outro-segredo'],
    ['com o segredo sem o prefixo Bearer', SECRET],
    ['com o prefixo e nada depois', 'Bearer '],
    ['com o segredo mais um caractere', `Bearer ${SECRET}x`],
  ])('recusa %s com 401', (_, authorization) => {
    expect(() => guard.canActivate(contextWith(authorization))).toThrow(UnauthorizedException);
  });
});
