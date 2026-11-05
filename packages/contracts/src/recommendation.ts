import { z } from 'zod';
import { DISCOVERY_MODES } from './auth';
import { FeatureLabelSchema, GameSummarySchema, positiveInt } from './catalog';
import { LibraryGameSchema } from './library';

export const RECOMMENDATION_REASONS_MAX = 3;
// Além do teto da lista a página vem vazia; este é só o limite do parâmetro.
export const RECOMMENDATIONS_PAGE_MAX = 1000;

export type DiscoveryMode = (typeof DISCOVERY_MODES)[number];

// Na URL o modo vai em minúsculas, como os outros parâmetros; a resposta usa os valores do banco.
export const MODE_PARAMS = {
  popular: 'POPULAR',
  balanced: 'BALANCED',
  discovery: 'DISCOVERY',
} as const satisfies Record<string, DiscoveryMode>;

const ModeParamSchema = z
  .enum(Object.keys(MODE_PARAMS) as [keyof typeof MODE_PARAMS], {
    error: 'Modo deve ser popular, balanced ou discovery.',
  })
  .transform((mode) => MODE_PARAMS[mode]);

// Sem modo, vale o salvo no usuário: a consulta não grava a escolha, quem grava é o PATCH /me.
export const RecommendationQuerySchema = z.object({ mode: ModeParamSchema.optional() });

export type RecommendationQuery = z.output<typeof RecommendationQuerySchema>;

export const RecommendationPageQuerySchema = RecommendationQuerySchema.extend({
  page: positiveInt(RECOMMENDATIONS_PAGE_MAX, 'A página').default(1),
});

export type RecommendationPageQuery = z.output<typeof RecommendationPageQuerySchema>;

// Os gêneros e temas que mais contribuíram, do maior para o menor, ou o jogo da biblioteca que
// mais pesou. Esse jogo pode ter saído do catálogo e vem marcado, como na biblioteca.
export const RecommendationReasonSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('features'),
    features: z.array(FeatureLabelSchema).min(1).max(RECOMMENDATION_REASONS_MAX),
  }),
  z.object({
    kind: z.literal('liked-game'),
    game: LibraryGameSchema.pick({ slug: true, name: true, inCatalog: true }),
  }),
]);

export type RecommendationReason = z.infer<typeof RecommendationReasonSchema>;

export const RecommendationSchema = z.object({
  game: GameSummarySchema,
  reason: RecommendationReasonSchema.nullable(),
  // Só no modo Descobertas: o jogo ficaria fora da lista se ela fosse montada só pela
  // similaridade.
  lowKnown: z.boolean(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// profile: pelo perfil; popular: o perfil não tem nenhum atributo a favor, e a lista é dos mais
// populares; empty: sem avaliações, listas nem preferências, o jogador vai para a partida a frio.
export const RECOMMENDATION_BASES = ['profile', 'popular', 'empty'] as const;

// O atributo de uma prateleira de interesse, com o nome em português: gênero ou tema, com os
// valores do banco, como o modo, ou um estilo curado (B-74).
export const RecommendationFeatureSchema = FeatureLabelSchema.extend({
  type: z.enum(['GENRE', 'THEME', 'STYLE']),
});

export type RecommendationFeature = z.infer<typeof RecommendationFeatureSchema>;

const listItems = {
  items: z.array(RecommendationSchema),
  // A lista completa tem mais jogos que os mostrados.
  hasMore: z.boolean(),
};

// Na visão geral, os itens já vêm sem os jogos que apareceram antes na página.
export const RecommendationShelfSchema = z.discriminatedUnion('kind', [
  z.object({
    key: z.literal('upcoming'),
    kind: z.literal('upcoming'),
    feature: z.null(),
    ...listItems,
  }),
  z.object({
    key: z.string().regex(/^(genre|theme|style):/),
    kind: z.literal('interest'),
    feature: RecommendationFeatureSchema,
    ...listItems,
  }),
]);

export type RecommendationShelf = z.infer<typeof RecommendationShelfSchema>;

export const RecommendationOverviewSchema = z.object({
  mode: z.enum(DISCOVERY_MODES),
  basis: z.enum(RECOMMENDATION_BASES),
  main: z.object(listItems),
  shelves: z.array(RecommendationShelfSchema),
});

export type RecommendationOverview = z.infer<typeof RecommendationOverviewSchema>;

// Uma página de uma lista só, para o "ver mais": main, upcoming, genre:<slug>, theme:<slug> ou
// style:<slug>.
export const RecommendationPageSchema = z.object({
  mode: z.enum(DISCOVERY_MODES),
  key: z.string(),
  feature: RecommendationFeatureSchema.nullable(),
  page: z.number().int().min(1),
  ...listItems,
});

export type RecommendationPage = z.infer<typeof RecommendationPageSchema>;
