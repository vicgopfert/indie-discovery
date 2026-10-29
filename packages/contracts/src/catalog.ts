import { z } from 'zod';

export const GAMES_PAGE_SIZE_DEFAULT = 24;
export const GAMES_PAGE_SIZE_MAX = 48;
export const GAMES_PAGE_MAX = 1000;
export const GAMES_FILTER_MAX_VALUES = 5;
export const GAMES_SEARCH_MAX_LENGTH = 100;

export const GAMES_SORTS = ['popular', 'newest', 'name'] as const;
export const RELEASE_STATUS_FILTERS = ['released', 'upcoming'] as const;
export const FEATURE_TYPE_FILTERS = ['genre', 'theme'] as const;

// A URL traz um valor (genre=a) ou vários (genre=a&genre=b); os dois viram lista, sem repetição.
const slugList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => [...new Set([value].flat().map((slug) => slug.trim()))])
  .pipe(
    z
      .array(
        z.string().min(1, { error: 'Filtro vazio.' }).max(100, { error: 'Filtro longo demais.' }),
      )
      .max(GAMES_FILTER_MAX_VALUES, {
        error: `Até ${GAMES_FILTER_MAX_VALUES} valores por filtro.`,
      }),
  )
  .default([]);

const positiveInt = (max: number, label: string) =>
  z.coerce
    .number({ error: `${label} deve ser um número.` })
    .int({ error: `${label} deve ser um número inteiro.` })
    .min(1, { error: `${label} começa em 1.` })
    .max(max, { error: `${label} vai até ${max}.` });

export const GameSearchQuerySchema = z.object({
  q: z
    .string({ error: 'Informe a busca uma vez só.' })
    .trim()
    .max(GAMES_SEARCH_MAX_LENGTH, {
      error: `A busca tem no máximo ${GAMES_SEARCH_MAX_LENGTH} caracteres.`,
    })
    .optional()
    .transform((q) => q || undefined),
  genre: slugList,
  theme: slugList,
  status: z
    .enum(RELEASE_STATUS_FILTERS, { error: 'Situação deve ser released ou upcoming.' })
    .optional(),
  sort: z
    .enum(GAMES_SORTS, { error: 'Ordenação deve ser popular, newest ou name.' })
    .default('popular'),
  page: positiveInt(GAMES_PAGE_MAX, 'A página').default(1),
  pageSize: positiveInt(GAMES_PAGE_SIZE_MAX, 'O tamanho da página').default(
    GAMES_PAGE_SIZE_DEFAULT,
  ),
});

export type GameSearchQuery = z.output<typeof GameSearchQuerySchema>;

export const FeatureLabelSchema = z.object({ slug: z.string(), name: z.string() });

export type FeatureLabel = z.infer<typeof FeatureLabelSchema>;

export const GameSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  coverImageId: z.string(),
  releaseStatus: z.enum(['RELEASED', 'UPCOMING']),
  firstReleaseDate: z.iso.date().nullable(),
  genres: z.array(FeatureLabelSchema),
});

export type GameSummary = z.infer<typeof GameSummarySchema>;

export const GamePageSchema = z.object({
  items: z.array(GameSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type GamePage = z.infer<typeof GamePageSchema>;

export const FeatureQuerySchema = z.object({
  type: z.enum(FEATURE_TYPE_FILTERS, { error: 'Tipo deve ser genre ou theme.' }),
});

export type FeatureQuery = z.output<typeof FeatureQuerySchema>;

export const FeatureOptionSchema = FeatureLabelSchema.extend({ gameCount: z.number().int() });

export type FeatureOption = z.infer<typeof FeatureOptionSchema>;

export const GameLanguageSchema = z.object({
  locale: z.string(),
  name: z.string(),
  interface: z.boolean(),
  subtitles: z.boolean(),
  audio: z.boolean(),
});

export type GameLanguage = z.infer<typeof GameLanguageSchema>;

export const StudioCountrySchema = z.object({
  code: z.string().length(2),
  name: z.string(),
  source: z.enum(['IGDB', 'WIKIDATA']),
});

export type StudioCountry = z.infer<typeof StudioCountrySchema>;

export const GameDetailSchema = GameSummarySchema.extend({
  summary: z.string(),
  themes: z.array(FeatureLabelSchema),
  developers: z.array(z.string()),
  publishers: z.array(z.string()),
  studioCountry: StudioCountrySchema.nullable(),
  languages: z.array(GameLanguageSchema),
  officialUrl: z.url({ protocol: /^https?$/ }).nullable(),
});

export type GameDetail = z.infer<typeof GameDetailSchema>;
