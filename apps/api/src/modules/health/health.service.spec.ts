import type { PrismaService } from '../../prisma/prisma.service';
import type {
  ContentIndexService,
  ContentIndexStatus,
} from '../recommendation/content-index.service';
import { HealthService } from './health.service';

const READY: ContentIndexStatus = {
  status: 'ready',
  games: 22807,
  loadedAt: new Date('2026-11-02T12:00:00Z'),
};

function healthWith(query: () => Promise<unknown>, index: ContentIndexStatus = READY) {
  return new HealthService(
    { $queryRaw: query } as unknown as PrismaService,
    { status: () => index } as unknown as ContentIndexService,
  );
}

const up = () => Promise.resolve([{ '?column?': 1 }]);

describe('HealthService', () => {
  it('informa o banco no ar e o índice pronto', async () => {
    await expect(healthWith(up).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      contentIndex: { status: 'ready', games: 22807, loadedAt: '2026-11-02T12:00:00.000Z' },
    });
  });

  it('informa o banco fora do ar sem derrubar a rota quando a consulta falha', async () => {
    const health = healthWith(() => Promise.reject(new Error('connection refused')));

    await expect(health.check()).resolves.toMatchObject({ status: 'degraded', database: 'down' });
  });

  it.each(['loading', 'failed'] as const)('fica degraded com o índice em %s', async (status) => {
    await expect(healthWith(up, { status }).check()).resolves.toEqual({
      status: 'degraded',
      database: 'up',
      contentIndex: { status },
    });
  });
});
