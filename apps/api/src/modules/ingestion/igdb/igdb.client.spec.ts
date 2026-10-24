import { Logger } from '@nestjs/common';
import { FakeIgdbServer } from '../../../../test/support/fake-igdb-server';
import { IgdbClient, type IgdbClientOptions, IgdbRequestError } from './igdb.client';

const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };

function maxRequestsInAnyWindow(times: number[], windowMs: number) {
  return Math.max(...times.map((t) => times.filter((s) => s >= t && s < t + windowMs).length));
}

describe('IgdbClient', () => {
  let server: FakeIgdbServer;
  let urls: { apiUrl: string; tokenUrl: string };

  function client(options: Partial<IgdbClientOptions> = {}) {
    return new IgdbClient({ credentials, ...urls, retryBaseDelayMs: 10, ...options });
  }

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    server = new FakeIgdbServer();
    urls = await server.start();
  });

  afterEach(() => server.stop());

  it('envia a query com o Client-ID e o token da Twitch e devolve o JSON', async () => {
    server.replyOnce({ status: 200, body: [{ id: 1, name: 'Celeste' }] });

    await expect(client().query('games', 'fields name; where id = 1;')).resolves.toEqual([
      { id: 1, name: 'Celeste' },
    ]);
    expect(server.requests[0]).toMatchObject({
      endpoint: 'games',
      body: 'fields name; where id = 1;',
      clientId: 'client-id',
      authorization: 'Bearer token-1',
    });
  });

  it('reaproveita o token entre requisições', async () => {
    const igdb = client();

    await Promise.all([igdb.query('games', ''), igdb.query('games', ''), igdb.query('games', '')]);

    expect(server.tokenRequests).toBe(1);
  });

  it('renova o token e repete a requisição quando a IGDB responde 401', async () => {
    server.replyOnce({ status: 401 }, { status: 200, body: [{ id: 1 }] });

    await expect(client().query('games', '')).resolves.toEqual([{ id: 1 }]);
    expect(server.tokenRequests).toBe(2);
    expect(server.requests.map((r) => r.authorization)).toEqual([
      'Bearer token-1',
      'Bearer token-2',
    ]);
  });

  it('tenta de novo com espera em 429, erro 5xx e falha de rede', async () => {
    server.replyOnce({ status: 429 }, { status: 503 }, 'drop-connection', {
      status: 200,
      body: [{ id: 1 }],
    });

    await expect(client().query('games', '')).resolves.toEqual([{ id: 1 }]);
    expect(server.requests).toHaveLength(4);
  });

  it('desiste depois do número máximo de tentativas', async () => {
    server.respond = () => ({ status: 500 });

    const result = client({ maxAttempts: 3 }).query('games', '');

    await expect(result).rejects.toThrow(IgdbRequestError);
    await expect(result).rejects.toThrow('HTTP 500 após 3 tentativas');
    expect(server.requests).toHaveLength(3);
  });

  it('não repete uma requisição inválida', async () => {
    server.replyOnce({ status: 400, body: { title: 'Syntax Error' } });

    await expect(client().query('games', 'fields;')).rejects.toThrow('HTTP 400');
    expect(server.requests).toHaveLength(1);
  });

  it('respeita o limite de 4 requisições por segundo da IGDB', async () => {
    const igdb = client();

    await Promise.all(Array.from({ length: 10 }, () => igdb.query('games', '')));

    const times = server.requests.map((r) => r.receivedAt);
    expect(times).toHaveLength(10);
    expect(maxRequestsInAnyWindow(times, 950)).toBeLessThanOrEqual(4);
    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThanOrEqual(1950);
  });

  it('não deixa mais de 8 requisições abertas ao mesmo tempo', async () => {
    server.respond = () => ({ status: 200, body: [], delayMs: 150 });
    const igdb = client({
      rateLimit: { requestsPerWindow: 100, windowMs: 1000, maxConcurrent: 8 },
    });

    await Promise.all(Array.from({ length: 20 }, () => igdb.query('games', '')));

    expect(server.maxInFlight).toBe(8);
  });

  it('percorre todas as páginas em ordem de id, a partir do último id recebido', async () => {
    const ids = [3, 7, 9, 12, 20];
    server.respond = ({ body }) => {
      const after = Number(/id > (\d+)/.exec(body)?.[1]);
      const limit = Number(/limit (\d+)/.exec(body)?.[1]);
      return {
        status: 200,
        body: ids
          .filter((id) => id > after)
          .slice(0, limit)
          .map((id) => ({ id })),
      };
    };

    const pages = [];
    for await (const page of client().paginate('games', {
      fields: 'name',
      where: 'themes != (42)',
      pageSize: 2,
    })) {
      pages.push(page.map((game) => game.id));
    }

    expect(pages).toEqual([[3, 7], [9, 12], [20]]);
    expect(server.requests.map((r) => r.body)).toEqual([
      'fields name; where (themes != (42)) & id > 0; sort id asc; limit 2;',
      'fields name; where (themes != (42)) & id > 7; sort id asc; limit 2;',
      'fields name; where (themes != (42)) & id > 12; sort id asc; limit 2;',
    ]);
  });
});
