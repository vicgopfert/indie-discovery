import { PrismaService } from './prisma.service';

// Verificação do B-02: o cliente gerado pelo Prisma 7 carrega e instancia numa
// API CommonJS sob o Jest, sem precisar de banco.
describe('PrismaService', () => {
  it('instancia o cliente gerado com o adapter pg', async () => {
    const prisma = new PrismaService();

    expect(typeof prisma.$queryRaw).toBe('function');
    await prisma.onModuleDestroy();
  });
});
