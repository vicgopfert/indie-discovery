import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api-client';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('não repete erros 4xx, como a falta de sessão', () => {
    expect(shouldRetry(0, new ApiRequestError(401, ['Sessão ausente ou expirada']))).toBe(false);
  });

  it('repete falhas de rede e do servidor até duas vezes', () => {
    const offline = new ApiRequestError(0, ['fora do ar']);

    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, new ApiRequestError(503, ['indisponível']))).toBe(true);
    expect(shouldRetry(2, offline)).toBe(false);
  });
});
