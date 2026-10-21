import { FakeIgdbServer } from '../../../test/support/fake-igdb-server';
import { TwitchTokenProvider } from './twitch-token-provider';

const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };

describe('TwitchTokenProvider', () => {
  let server: FakeIgdbServer;
  let tokenUrl: string;
  let now: number;

  beforeEach(async () => {
    server = new FakeIgdbServer();
    ({ tokenUrl } = await server.start());
    now = 0;
  });

  afterEach(() => server.stop());

  function provider() {
    return new TwitchTokenProvider(credentials, tokenUrl, () => now);
  }

  it('reaproveita o token enquanto ele não está perto de expirar', async () => {
    const tokens = provider();

    await tokens.get();
    now = 3_500_000;

    await expect(tokens.get()).resolves.toBe('token-1');
    expect(server.tokenRequests).toBe(1);
  });

  it('renova o token um minuto antes de ele expirar', async () => {
    const tokens = provider();

    await tokens.get();
    now = 3_541_000;

    await expect(tokens.get()).resolves.toBe('token-2');
  });

  it('faz uma única requisição quando vários pedidos chegam juntos', async () => {
    const tokens = provider();

    await Promise.all([tokens.get(), tokens.get(), tokens.get()]);

    expect(server.tokenRequests).toBe(1);
  });

  it('só descarta o token recusado, não um que já foi renovado', async () => {
    const tokens = provider();
    await tokens.get();

    tokens.invalidate('token-0');

    await expect(tokens.get()).resolves.toBe('token-1');
  });
});
