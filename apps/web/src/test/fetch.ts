import type { User } from '@indie/contracts';
import { vi } from 'vitest';

export const sampleUser: User = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  email: 'jogadora@example.com',
  displayName: 'Jogadora',
  role: 'USER',
  discoveryMode: 'BALANCED',
  onboardingCompletedAt: null,
  createdAt: '2026-10-27T12:00:00.000Z',
};

export const apiError = (status: number, message: string | string[]) =>
  Response.json({ statusCode: status, error: 'Erro', message, requestId: 'req-1' }, { status });

// Responde cada chamada com o que `reply` devolver para o caminho e o método.
export function stubFetch(reply: (path: string, method: string) => Response) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) =>
    Promise.resolve().then(() => reply(input, init?.method ?? 'GET')),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
