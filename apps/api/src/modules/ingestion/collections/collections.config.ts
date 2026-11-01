import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { hasUniqueIds, igdbEntity } from '../criteria/indie-criteria.config';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// Regras só do script de sugestão: nenhum jogo entra numa coleção sem estar em `games`.
const suggestionRules = z.object({
  keywords: z.array(z.string().min(1)),
  summaryTerms: z.array(z.string().min(1)),
  wikidataPlaces: z.array(z.string().regex(/^Q\d+$/)),
});

const rejectedGame = igdbEntity.extend({ reason: z.string().min(1) });

const collection = z
  .object({
    slug,
    name: z.string().min(1),
    description: z.string().min(1),
    scope: z.string().min(1),
    // Rascunho fica fora do banco e do mínimo de jogos: é como a coleção nova passa pela curadoria.
    published: z.boolean(),
    suggest: suggestionRules,
    games: z.array(igdbEntity).refine(hasUniqueIds, { message: 'Jogo repetido na coleção.' }),
    rejected: z
      .array(rejectedGame)
      .refine(hasUniqueIds, { message: 'Jogo repetido entre os recusados da coleção.' }),
  })
  .refine((c) => !c.rejected.some((r) => c.games.some((g) => g.igdbId === r.igdbId)), {
    message: 'Jogo aprovado e recusado na mesma coleção.',
  });

// A ordem do arquivo é a ordem de exibição.
export const collectionsConfigSchema = z
  .object({
    curationPolicy: z.string().min(1),
    minGames: z.number().int().positive(),
    minGamesRationale: z.string().min(1),
    collections: z.array(collection),
  })
  .superRefine(({ minGames, collections }, ctx) => {
    if (new Set(collections.map((c) => c.slug)).size !== collections.length) {
      ctx.addIssue({ code: 'custom', message: 'Slug de coleção repetido.' });
    }
    for (const c of collections.filter((c) => c.published && c.games.length < minGames)) {
      ctx.addIssue({
        code: 'custom',
        message: `A coleção ${c.slug} tem ${c.games.length} jogos, abaixo do mínimo de ${minGames}.`,
      });
    }
  });

export type CollectionsConfig = z.infer<typeof collectionsConfigSchema>;
export type CuratedCollection = CollectionsConfig['collections'][number];

export const COLLECTIONS_FILE = resolve(process.cwd(), 'config/collections.json');

export function readCollectionsConfig(file = COLLECTIONS_FILE): CollectionsConfig {
  return collectionsConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
