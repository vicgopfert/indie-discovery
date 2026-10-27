import type { Request, Response } from 'express';
import { assignRequestId } from './request-id.middleware';

function run(incoming?: string) {
  const request = { get: () => incoming } as unknown as Request;
  const setHeader = jest.fn();
  const next = jest.fn();
  assignRequestId(request, { setHeader } as unknown as Response, next);
  return { request, setHeader, next };
}

describe('assignRequestId', () => {
  it('gera um id e o devolve no cabeçalho', () => {
    const { request, setHeader, next } = run();

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('aceita o id de quem chamou', () => {
    expect(run('trace-abc-123').request.requestId).toBe('trace-abc-123');
  });

  it.each([
    ['com caracteres que quebrariam o log', 'abc\n{"level":"error"}'],
    ['curto demais', 'abc'],
    ['longo demais', 'a'.repeat(65)],
  ])('troca um id %s por um novo', (_, incoming) => {
    expect(run(incoming).request.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
