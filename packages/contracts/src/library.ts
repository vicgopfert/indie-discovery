import { z } from 'zod';
import { FeatureLabelSchema, FeatureOptionSchema, GameSummarySchema } from './catalog';

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const RatingScoreSchema = z
  .number({ error: 'A nota deve ser um número.' })
  .int({ error: 'A nota deve ser um número inteiro.' })
  .min(RATING_MIN, { error: `A nota vai de ${RATING_MIN} a ${RATING_MAX}.` })
  .max(RATING_MAX, { error: `A nota vai de ${RATING_MIN} a ${RATING_MAX}.` });

export const RatingInputSchema = z.object({ score: RatingScoreSchema });

export type RatingInput = z.infer<typeof RatingInputSchema>;

export const RatingSchema = z.object({ score: RatingScoreSchema, updatedAt: z.iso.datetime() });

export type Rating = z.infer<typeof RatingSchema>;

export const LIST_TYPES = ['FAVORITE', 'COMPLETED', 'WANT_TO_PLAY'] as const;

export const ListTypeSchema = z.enum(LIST_TYPES, {
  error: 'Lista deve ser FAVORITE, COMPLETED ou WANT_TO_PLAY.',
});

export type ListType = z.infer<typeof ListTypeSchema>;

// Na URL a lista vai em minúsculas, como os outros parâmetros; a resposta usa os valores do banco.
export const LIST_PARAMS = {
  favorite: 'FAVORITE',
  completed: 'COMPLETED',
  'want-to-play': 'WANT_TO_PLAY',
} as const satisfies Record<string, ListType>;

export const ListParamSchema = z
  .enum(Object.keys(LIST_PARAMS) as [keyof typeof LIST_PARAMS], {
    error: 'Lista deve ser favorite, completed ou want-to-play.',
  })
  .transform((list) => LIST_PARAMS[list]);

export const GameListsSchema = z.object({ lists: z.array(ListTypeSchema) });

export type GameLists = z.infer<typeof GameListsSchema>;

// A biblioteca mantém o jogo que saiu do catálogo, marcado, para ele não sumir sem explicação.
export const LibraryGameSchema = GameSummarySchema.extend({ inCatalog: z.boolean() });

export type LibraryGame = z.infer<typeof LibraryGameSchema>;

export const LibraryListEntrySchema = z.object({
  game: LibraryGameSchema,
  addedAt: z.iso.datetime(),
});

export const LibrarySchema = z.object({
  ratings: z.array(RatingSchema.extend({ game: LibraryGameSchema })),
  lists: z.object({
    FAVORITE: z.array(LibraryListEntrySchema),
    COMPLETED: z.array(LibraryListEntrySchema),
    WANT_TO_PLAY: z.array(LibraryListEntrySchema),
  }),
});

export type Library = z.infer<typeof LibrarySchema>;

// A nota e as listas de um jogo só, para a ficha mostrar o estado sem pedir a biblioteca inteira.
export const GameLibraryStateSchema = z.object({
  rating: RatingSchema.nullable(),
  lists: z.array(ListTypeSchema),
});

export type GameLibraryState = z.infer<typeof GameLibraryStateSchema>;

export const PREFERENCES_MIN = 3;
export const PREFERENCES_MAX_PER_TYPE = 50;

const preferenceSlugs = (label: string) =>
  z
    .array(
      z.string().trim().min(1, { error: 'Slug vazio.' }).max(100, { error: 'Slug longo demais.' }),
      {
        error: `Informe os ${label} como lista.`,
      },
    )
    .max(PREFERENCES_MAX_PER_TYPE, {
      error: `Até ${PREFERENCES_MAX_PER_TYPE} ${label}.`,
    })
    .default([])
    .transform((slugs) => [...new Set(slugs)]);

export const PreferencesInputSchema = z
  .object({
    genres: preferenceSlugs('gêneros'),
    themes: preferenceSlugs('temas'),
    tags: preferenceSlugs('etiquetas'),
  })
  .refine(
    ({ genres, themes, tags }) => genres.length + themes.length + tags.length >= PREFERENCES_MIN,
    { error: `Escolha pelo menos ${PREFERENCES_MIN} gêneros, temas ou etiquetas.` },
  );

export type PreferencesInput = z.output<typeof PreferencesInputSchema>;

export const PreferencesSchema = z.object({
  genres: z.array(FeatureLabelSchema),
  themes: z.array(FeatureLabelSchema),
  tags: z.array(FeatureLabelSchema),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const PreferenceOptionsSchema = z.object({
  genres: z.array(FeatureOptionSchema),
  themes: z.array(FeatureOptionSchema),
  tags: z.array(FeatureOptionSchema),
});

export type PreferenceOptions = z.infer<typeof PreferenceOptionsSchema>;
