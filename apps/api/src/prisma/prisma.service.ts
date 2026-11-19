import type { OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// A conexão só abre na primeira consulta: a API sobe mesmo com o Neon suspenso.
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(connectionString: string) {
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  // O último passo do desligamento, depois do trabalho em andamento (BackgroundTasks).
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
