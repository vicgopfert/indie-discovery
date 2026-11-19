import { BackgroundTasks } from '../src/common/background-tasks';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './support/e2e-app';

describe('Desligamento da API', () => {
  it('termina o trabalho em andamento antes de desconectar o banco', async () => {
    const app = await createApp();
    const tasks = app.get(BackgroundTasks);
    const prisma = app.get(PrismaService);
    const events: string[] = [];
    const disconnect = prisma.$disconnect.bind(prisma);
    jest.spyOn(prisma, '$disconnect').mockImplementation(() => {
      events.push('banco desconectado');
      return disconnect();
    });
    let release!: () => void;
    const started = new Promise<void>((resolve) => (release = resolve));

    tasks.run('consulta durante o desligamento', async () => {
      await started;
      await prisma.user.count();
      events.push('consulta terminada');
    });
    const closed = app.close();
    setTimeout(release, 100);
    await closed;

    expect(events).toEqual(['consulta terminada', 'banco desconectado']);
  });
});
