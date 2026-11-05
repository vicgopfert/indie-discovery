import type { PrismaService } from '../../prisma/prisma.service';
import { ContentIndexRepository, LOAD_TRANSACTION_TIMEOUT_MS } from './content-index.repository';

describe('ContentIndexRepository', () => {
  it('lê a carga numa transação com tempo-limite explícito e folgado', async () => {
    const transaction = jest.fn<Promise<unknown[]>, [unknown[], { timeout?: number }]>(() =>
      Promise.resolve([[], [], []]),
    );
    const prisma = { $transaction: transaction, $queryRaw: jest.fn(() => ({})) };

    await new ContentIndexRepository(prisma as unknown as PrismaService).loadRows(['roguelike']);

    expect(transaction.mock.calls[0]![1]).toMatchObject({
      isolationLevel: 'RepeatableRead',
      timeout: LOAD_TRANSACTION_TIMEOUT_MS,
    });
    expect(LOAD_TRANSACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });
});
