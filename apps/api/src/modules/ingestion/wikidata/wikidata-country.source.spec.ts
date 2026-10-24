import { FakeIgdbServer } from '../../../../test/support/fake-igdb-server';
import { WikidataCountrySource } from './wikidata-country.source';

const literal = (value: string) => ({ type: 'literal', value });
const results = (rows: Record<string, string>[]) => ({
  head: { vars: ['igdb', 'developerCountry', 'originCountry'] },
  results: {
    bindings: rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, literal(value)])),
    ),
  },
});

describe('WikidataCountrySource', () => {
  let server: FakeIgdbServer;
  let source: WikidataCountrySource;

  beforeEach(async () => {
    server = new FakeIgdbServer();
    const { apiUrl } = await server.start();
    source = new WikidataCountrySource({
      endpoint: `${apiUrl}/sparql`,
      maxAttempts: 2,
      retryDelayMs: 1,
    });
  });

  afterEach(() => server.stop());

  it('agrupa os países por slug da IGDB, separando desenvolvedora e origem', async () => {
    server.respond = () => ({
      status: 200,
      body: results([
        { igdb: 'hitman-absolution', developerCountry: '826', originCountry: '208' },
        { igdb: 'hitman-absolution', developerCountry: '208', originCountry: '208' },
        { igdb: 'jogo-brasileiro', originCountry: '76' },
      ]),
    });

    const countries = await source.countriesBySlug();

    expect(countries.get('hitman-absolution')).toEqual({
      developer: new Set([826, 208]),
      origin: new Set([208]),
    });
    expect(countries.get('jogo-brasileiro')).toEqual({
      developer: new Set(),
      origin: new Set([76]),
    });
    expect(server.requests[0]?.endpoint).toContain('sparql?query=');
  });

  it('tenta de novo depois de uma falha do serviço', async () => {
    server.replyOnce({ status: 503 });
    server.respond = () => ({
      status: 200,
      body: results([{ igdb: 'jogo', originCountry: '76' }]),
    });

    expect((await source.countriesBySlug()).size).toBe(1);
    expect(server.requests).toHaveLength(2);
  });

  it('desiste depois do número máximo de tentativas', async () => {
    server.respond = () => ({ status: 429 });

    await expect(source.countriesBySlug()).rejects.toThrow('HTTP 429 após 2 tentativas');
  });
});
