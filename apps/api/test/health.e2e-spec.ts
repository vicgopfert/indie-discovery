import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { ContentIndexRepository } from '../src/modules/recommendation/content-index.repository';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';

describe('GET /api/health', () => {
  async function start(override?: Partial<ContentIndexRepository>) {
    const builder = Test.createTestingModule({ imports: [AppModule] });
    if (override) builder.overrideProvider(ContentIndexRepository).useValue(override);
    const app: INestApplication<App> = (await builder.compile()).createNestApplication();
    configureApp(app);
    await app.init();
    await app.get(ContentIndexService).settled();
    return app;
  }

  it('responde que a API, o banco e o índice estão no ar', async () => {
    const app = await start();
    try {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        database: 'up',
        contentIndex: { status: 'ready' },
      });
    } finally {
      await app.close();
    }
  });

  // O Render só tira do ar uma instância que responde fora de 2xx e 3xx.
  it('com o índice em falha, continua respondendo 200, em degraded', async () => {
    const app = await start({ loadRows: () => Promise.reject(new Error('falha simulada')) });
    try {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(res.body).toEqual({
        status: 'degraded',
        database: 'up',
        contentIndex: { status: 'failed' },
      });
    } finally {
      await app.close();
    }
  });
});
