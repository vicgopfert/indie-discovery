import type { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from './health.service';

function healthWithDatabase(query: () => Promise<unknown>) {
  return new HealthService({ $queryRaw: query } as unknown as PrismaService);
}

describe('HealthService', () => {
  it('informa o banco no ar quando a consulta responde', async () => {
    const health = healthWithDatabase(() => Promise.resolve([{ '?column?': 1 }]));

    await expect(health.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('informa o banco fora do ar sem derrubar a rota quando a consulta falha', async () => {
    const health = healthWithDatabase(() => Promise.reject(new Error('connection refused')));

    await expect(health.check()).resolves.toEqual({ status: 'degraded', database: 'down' });
  });
});
