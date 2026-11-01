import { existsSync } from 'node:fs';
import { FeatureType } from './generated/prisma/client';
import { apiEnvSchema, parseEnv, rootEnvFile } from './config/env';
import {
  type Candidate,
  narrativePlacesBySlug,
  suggestCandidates,
} from './modules/ingestion/collections/candidate-suggestions';
import { readCollectionsConfig } from './modules/ingestion/collections/collections.config';
import { PrismaService } from './prisma/prisma.service';

// Lista os candidatos de cada coleção que ainda não foram aprovados nem recusados, com a evidência.
// Uso: pnpm --filter api collections:suggest [slug...] [--json]
async function main() {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const { DATABASE_URL } = parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), process.env);
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const slugs = args.filter((arg) => !arg.startsWith('--'));

  const config = readCollectionsConfig();
  const collections = config.collections.filter(
    (c) => slugs.length === 0 || slugs.includes(c.slug),
  );
  const unknown = slugs.filter((slug) => !config.collections.some((c) => c.slug === slug));
  if (unknown.length > 0)
    throw new Error(`Coleção não encontrada no arquivo: ${unknown.join(', ')}`);

  const prisma = new PrismaService(DATABASE_URL);
  try {
    const rows = await prisma.game.findMany({
      where: { inCatalog: true },
      select: {
        igdbId: true,
        slug: true,
        name: true,
        summary: true,
        popularityCount: true,
        features: {
          where: { feature: { type: FeatureType.KEYWORD } },
          select: { feature: { select: { slug: true } } },
        },
      },
    });
    const games = rows.map(({ features, ...game }) => ({
      ...game,
      keywords: features.map(({ feature }) => feature.slug),
    }));
    const places = await narrativePlacesBySlug();

    const result = collections.map((c) => ({
      slug: c.slug,
      candidates: suggestCandidates(c, games, places),
    }));
    console.log(asJson ? JSON.stringify(result, null, 2) : result.map(markdown).join('\n\n'));
  } finally {
    await prisma.$disconnect();
  }
}

function markdown({ slug, candidates }: { slug: string; candidates: Candidate[] }) {
  const rows = candidates.map(
    (c) => `| ${c.igdbId} | ${c.name} | ${c.popularityCount} | ${c.evidence.join('<br>')} |`,
  );
  return [
    `## ${slug}: ${candidates.length} candidatos`,
    '',
    '| igdbId | Jogo | "Want to Play" | Evidência |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
