import { Logger } from '@nestjs/common';
import { FakeIgdbServer } from '../../../test/support/fake-igdb-server';
import { STEAM_ITEMS_PER_REQUEST, SteamStoreClient, SteamStoreError } from './steam-store.client';

const fast = { rateLimit: { requestsPerWindow: 100, windowMs: 1000, maxConcurrent: 1 } };

describe('SteamStoreClient', () => {
  let server: FakeIgdbServer;
  let apiUrl: string;

  const client = () => new SteamStoreClient({ apiUrl, retryBaseDelayMs: 10, ...fast });
  const inputOf = (endpoint: string) =>
    JSON.parse(new URL(endpoint, 'http://x/').searchParams.get('input_json')!) as {
      ids: { appid: number }[];
      data_request: { include_tag_count: number };
    };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    server = new FakeIgdbServer();
    apiUrl = (await server.start()).apiUrl.replace(/\/v4$/, '');
  });

  afterEach(() => server.stop());

  it('lê os nomes das etiquetas no idioma pedido, sem espaços nas pontas', async () => {
    server.replyOnce({
      status: 200,
      body: {
        response: {
          tags: [
            { tagid: 1716, name: 'Roguelike' },
            { tagid: 4085, name: '2D ' },
          ],
        },
      },
    });

    const names = await client().tagNames('brazilian');

    expect([...names]).toEqual([
      [1716, 'Roguelike'],
      [4085, '2D'],
    ]);
    expect(server.requests[0]!.endpoint).toContain(
      'IStoreService/GetTagList/v1/?language=brazilian',
    );
  });

  it('pede as etiquetas em lotes, com até 20 por jogo, e deixa de fora o que a loja não achou', async () => {
    const appids = Array.from({ length: STEAM_ITEMS_PER_REQUEST + 2 }, (_, i) => 1000 + i);
    server.respond = ({ endpoint }) => ({
      status: 200,
      body: {
        response: {
          store_items: inputOf(endpoint).ids.map(({ appid }) =>
            appid === 1001
              ? { success: 2 }
              : appid === 1002
                ? { appid, success: 1, tags: [] }
                : { appid, success: 1, tags: [{ tagid: 1716, weight: appid }] },
          ),
        },
      },
    });

    const tags = await client().tagsOf(appids);

    expect(server.requests).toHaveLength(2);
    expect(inputOf(server.requests[0]!.endpoint).ids).toHaveLength(STEAM_ITEMS_PER_REQUEST);
    expect(inputOf(server.requests[0]!.endpoint).data_request.include_tag_count).toBe(20);
    expect(tags.size).toBe(appids.length - 2);
    expect(tags.get(1000)).toEqual([{ tagid: 1716, weight: 1000 }]);
    expect(tags.has(1001)).toBe(false);
    expect(tags.has(1002)).toBe(false);
  });

  it('tenta de novo depois de 429 ou 5xx, e desiste sem repetir num 4xx', async () => {
    server.replyOnce(
      { status: 429 },
      { status: 503 },
      { status: 200, body: { response: { tags: [] } } },
    );
    await expect(client().tagNames('english')).resolves.toEqual(new Map());
    expect(server.requests).toHaveLength(3);

    server.replyOnce({ status: 403 });
    await expect(client().tagNames('english')).rejects.toThrow(SteamStoreError);
    expect(server.requests).toHaveLength(4);
  });

  it('desiste depois do número máximo de tentativas', async () => {
    server.respond = () => ({ status: 500 });

    await expect(
      new SteamStoreClient({ apiUrl, retryBaseDelayMs: 1, maxAttempts: 2, ...fast }).tagNames(
        'english',
      ),
    ).rejects.toThrow('HTTP 500 após 2 tentativas');
  });
});
