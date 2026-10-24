import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import type { WikidataCountries } from '../studio-country/studio-country';

export interface WikidataOptions {
  endpoint: string;
  userAgent: string;
  timeoutMs: number;
  maxAttempts: number;
  retryDelayMs: number;
}

// A política do Wikidata pede um User-Agent com contato: o do repositório público.
export const WIKIDATA_DEFAULTS: WikidataOptions = {
  endpoint: 'https://query.wikidata.org/sparql',
  userAgent: 'indie-discovery/0.1 (https://github.com/vicgopfert/indie-discovery)',
  timeoutMs: 120_000,
  maxAttempts: 3,
  retryDelayMs: 5000,
};

// Itens com o identificador da IGDB (P5794, que é o slug do jogo), com o código numérico ISO
// (P299) do país da desenvolvedora (P178 → P17) e do país de origem do jogo (P495).
const COUNTRIES_QUERY = `
SELECT ?igdb ?developerCountry ?originCountry WHERE {
  ?game wdt:P5794 ?igdb .
  OPTIONAL { ?game wdt:P178/wdt:P17/wdt:P299 ?developerCountry . }
  OPTIONAL { ?game wdt:P495/wdt:P299 ?originCountry . }
  FILTER(BOUND(?developerCountry) || BOUND(?originCountry))
}`;

const literal = z.object({ value: z.string() });
const resultsSchema = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        igdb: literal,
        developerCountry: literal.optional(),
        originCountry: literal.optional(),
      }),
    ),
  }),
});

export class WikidataCountrySource {
  private readonly options: WikidataOptions;

  constructor(options: Partial<WikidataOptions> = {}) {
    this.options = { ...WIKIDATA_DEFAULTS, ...options };
  }

  // Uma consulta só, de alguns segundos, para o catálogo inteiro.
  async countriesBySlug() {
    const { bindings } = resultsSchema.parse(await this.query(COUNTRIES_QUERY)).results;
    const bySlug = new Map<string, { developer: Set<number>; origin: Set<number> }>();
    for (const { igdb, developerCountry, originCountry } of bindings) {
      const entry = bySlug.get(igdb.value) ?? { developer: new Set(), origin: new Set() };
      if (developerCountry) entry.developer.add(Number(developerCountry.value));
      if (originCountry) entry.origin.add(Number(originCountry.value));
      bySlug.set(igdb.value, entry);
    }
    return bySlug as ReadonlyMap<string, WikidataCountries>;
  }

  private async query(sparql: string): Promise<unknown> {
    const url = new URL(this.options.endpoint);
    url.searchParams.set('query', sparql);
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': this.options.userAgent,
        },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

      if (response instanceof Response && response.ok) return response.json();
      const reason =
        response instanceof Response
          ? `HTTP ${response.status}`
          : `falha de rede (${response.message})`;
      if (response instanceof Response) await response.body?.cancel();
      if (attempt === this.options.maxAttempts) {
        throw new Error(`Wikidata: ${reason} após ${attempt} tentativas`);
      }
      await sleep(this.options.retryDelayMs * attempt);
    }
  }
}
