import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('instancia o cliente gerado com o adapter pg', async () => {
    const prisma = new PrismaService('postgresql://indie:indie@localhost:5432/indie');

    expect(typeof prisma.$queryRaw).toBe('function');
    await prisma.onModuleDestroy();
  });
});
