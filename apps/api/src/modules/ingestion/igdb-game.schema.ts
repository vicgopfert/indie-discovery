import { z } from 'zod';

const igdbId = z.number().int();
const namedEntity = z.object({ id: igdbId, name: z.string() });

export const igdbGameSchema = z.object({
  id: igdbId,
  name: z.string(),
  slug: z.string(),
  summary: z.string().optional(),
  first_release_date: z.number().int().optional(),
  game_status: z.number().int().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
  genres: z.array(namedEntity).default([]),
  themes: z.array(namedEntity).default([]),
  keywords: z.array(namedEntity).default([]),
  involved_companies: z
    .array(
      z.object({
        developer: z.boolean(),
        publisher: z.boolean(),
        company: z.object({ id: igdbId, name: z.string(), country: z.number().int().optional() }),
      }),
    )
    .default([]),
  language_supports: z
    .array(
      z.object({ language: z.object({ id: igdbId }), language_support_type: z.number().int() }),
    )
    .default([]),
  websites: z.array(z.object({ type: z.number().int(), url: z.string() })).default([]),
  total_rating_count: z.number().int().optional(),
  hypes: z.number().int().optional(),
});

export type IgdbGame = z.infer<typeof igdbGameSchema>;

export const IGDB_GAME_FIELDS = [
  'name',
  'slug',
  'summary',
  'first_release_date',
  'game_status',
  'cover.image_id',
  'genres.name',
  'themes.name',
  'keywords.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'involved_companies.company.name',
  'involved_companies.company.country',
  'language_supports.language.id',
  'language_supports.language_support_type',
  'websites.type',
  'websites.url',
  'total_rating_count',
  'hypes',
].join(',');
