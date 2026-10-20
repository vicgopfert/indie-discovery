import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('instancia o cliente gerado com o adapter pg', async () => {
    const prisma = new PrismaService();

    expect(typeof prisma.$queryRaw).toBe('string');
    await prisma.onModuleDestroy();
  });
});
