import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { contentIndexLoaded } from './content-index';

export async function createApp(
  override?: (builder: ReturnType<typeof Test.createTestingModule>) => void,
) {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  override?.(builder);
  const moduleRef = await builder
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  await contentIndexLoaded(app);
  return app;
}

export function sessionHelpers(app: INestApplication<App>) {
  const origin = app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN');
  const server = () => request(app.getHttpServer());
  const register = async (email: string) => {
    const response = await server()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, displayName: 'Jogadora', password: 'senha-forte' });
    return String(response.headers['set-cookie']).split(';')[0]!;
  };
  const as = (cookie: string) => ({
    get: (path: string) => server().get(path).set('Cookie', cookie),
    put: (path: string, body?: object) =>
      server().put(path).set('Cookie', cookie).set('Origin', origin).send(body),
    patch: (path: string, body: object) =>
      server().patch(path).set('Cookie', cookie).set('Origin', origin).send(body),
    delete: (path: string) => server().delete(path).set('Cookie', cookie).set('Origin', origin),
  });
  return { server, register, as };
}
