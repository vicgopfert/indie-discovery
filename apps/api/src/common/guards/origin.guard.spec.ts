import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ApiEnv } from '../../config/env';
import { SkipOriginCheck } from '../decorators/skip-origin-check.decorator';
import { OriginGuard } from './origin.guard';

function contextWith(method: string, origin?: string, handler: () => void = () => undefined) {
  const request = { method, get: (name: string) => (name === 'origin' ? origin : undefined) };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => Object,
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  const env = { get: () => 'https://indie.example/' } as unknown as ConfigService<ApiEnv, true>;
  const guard = new OriginGuard(env, new Reflector());

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

  it('libera sem Origin a rota marcada para chamada de servidor para servidor', () => {
    const handler = () => undefined;
    SkipOriginCheck()(handler, 'handler', { value: handler });

    expect(guard.canActivate(contextWith('POST', undefined, handler))).toBe(true);
  });
});
