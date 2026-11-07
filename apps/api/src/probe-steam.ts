import { existsSync } from 'node:fs';
import { rootEnvFile } from './config/env';
import { validateIngestionEnv } from './config/ingestion-env';
import { FeatureType } from './generated/prisma/client';
import { IgdbCatalogSource } from './modules/ingestion/igdb/igdb-catalog.source';
import { IgdbClient } from './modules/ingestion/igdb/igdb.client';
import { readIngestionConfig } from './modules/ingestion/ingestion-config';
import { STEAM_STORE_DEFAULTS, SteamStoreClient } from './modules/tags/steam-store.client';
import { readTagVocabulary, tagAssigner } from './modules/tags/tags';
import { PrismaService } from './prisma/prisma.service';

// Sonda da rota de etiquetas da Steam (B-78), só leitura: confere, do lugar onde a ingestão roda
// (o GitHub Actions), se a loja responde, com o status, o tempo e as falhas de cada requisição.
// Amostra sistemática do catálogo gravado: um a cada k jogos, na ordem do igdbId. Nada é gravado.
//
//   node dist/probe-steam.js [--games 200]

interface SteamCall {
  status: number | 'falha de rede';
  ms: number;
}

async function main() {
  const at = process.argv.indexOf('--games');
  const size = at >= 0 ? Number(process.argv[at + 1]) : 200;
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const env = validateIngestionEnv(process.env);
  const calls = recordSteamCalls();

  const prisma = new PrismaService(env.DATABASE_URL);
  try {
    const catalog = await prisma.game.findMany({
      where: { inCatalog: true },
      orderBy: { igdbId: 'asc' },
      select: {
        igdbId: true,
        summary: true,
        features: {
          where: { feature: { type: FeatureType.KEYWORD } },
          select: { feature: { select: { slug: true } } },
        },
      },
    });
    const step = Math.max(1, Math.floor(catalog.length / size));
    const sample = catalog.filter((_, i) => i % step === 0).slice(0, size);

    const igdb = new IgdbClient({
      credentials: { clientId: env.IGDB_CLIENT_ID, clientSecret: env.IGDB_CLIENT_SECRET },
    });
    const appids = await new IgdbCatalogSource(igdb, readIngestionConfig()).steamAppIds(
      sample.map((game) => game.igdbId),
    );

    const out = ['## Sonda da Steam (B-78)', ''];
    out.push(`- Quando: ${new Date().toISOString()}`);
    out.push(
      `- Amostra: ${sample.length} de ${catalog.length} jogos do catálogo (um a cada ${step})`,
    );
    out.push(`- Com id da Steam na IGDB: ${appids.size}`);

    const start = performance.now();
    let failure: string | null = null;
    let steamTags = new Map<number, { tagid: number; weight: number }[]>();
    try {
      steamTags = await new SteamStoreClient().tagsOf([...new Set([...appids.values()].flat())]);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    const seconds = ((performance.now() - start) / 1000).toFixed(1);

    out.push('', '### Requisições à loja', '');
    out.push(`- Resultado: ${failure === null ? 'a Steam respondeu' : `falhou (${failure})`}`);
    out.push(`- Tempo da etapa: ${seconds} s, com uma requisição por segundo`);
    out.push(`- Requisições: ${calls.length}`);
    for (const [status, count] of countBy(calls.map((call) => String(call.status)))) {
      out.push(`  - ${status}: ${count}`);
    }
    const latencies = calls.map((call) => call.ms).sort((a, b) => a - b);
    if (latencies.length > 0) {
      const median = latencies[Math.floor(latencies.length / 2)]!;
      out.push(
        `- Latência: mediana ${Math.round(median)} ms, máxima ${Math.round(latencies.at(-1)!)} ms`,
      );
    }

    if (failure === null) {
      const assign = tagAssigner(readTagVocabulary());
      const sources = countBy(
        sample.map(
          (game) =>
            assign(
              {
                appids: appids.get(game.igdbId) ?? [],
                keywords: game.features.map(({ feature }) => feature.slug),
                summary: game.summary,
              },
              steamTags,
            ).source ?? 'sem etiqueta',
        ),
      );
      out.push('', '### Etiquetas da amostra', '');
      out.push(`- Ids com etiquetas na Steam: ${steamTags.size}`);
      for (const [source, count] of sources) out.push(`- ${source}: ${count} jogos`);
    }
    console.log(out.join('\n'));
    process.exitCode = failure === null ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Envolve o fetch global para anotar só as chamadas à loja, sem mudar o cliente da Steam.
function recordSteamCalls(): SteamCall[] {
  const calls: SteamCall[] = [];
  const fetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const isSteam = String(input instanceof Request ? input.url : input).startsWith(
      STEAM_STORE_DEFAULTS.apiUrl,
    );
    const start = performance.now();
    try {
      const response = await fetch(input, init);
      if (isSteam) calls.push({ status: response.status, ms: performance.now() - start });
      return response;
    } catch (error) {
      if (isSteam) calls.push({ status: 'falha de rede', ms: performance.now() - start });
      throw error;
    }
  };
  return calls;
}

function countBy(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

void main();
