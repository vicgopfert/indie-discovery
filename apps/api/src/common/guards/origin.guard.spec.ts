import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../../config/env';
import { OriginGuard } from './origin.guard';

function contextWith(method: string, origin?: string) {
  const request = { method, get: (name: string) => (name === 'origin' ? origin : undefined) };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  const env = { get: () => 'https://indie.example/' } as unknown as ConfigService<ApiEnv, true>;
  const guard = new OriginGuard(env);

  it('libera leitura de qualquer origem', () => {
    expect(guard.canActivate(contextWith('GET', 'https://outro.example'))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('libera %s vindo do frontend', (method) => {
    expect(guard.canActivate(contextWith(method, 'https://indie.example'))).toBe(true);
  });

  it.each([
    ['de outra origem', 'https://outro.example'],
    ['sem Origin', undefined],
    ['de um subdomínio', 'https://api.indie.example'],
  ])('recusa POST %s com 403', (_, origin) => {
    expect(() => guard.canActivate(contextWith('POST', origin))).toThrow(ForbiddenException);
  });
});
