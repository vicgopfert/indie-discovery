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

// As etiquetas, gêneros ou temas que mais contribuíram, do maior para o menor. O motivo "Porque
// você gostou de <jogo>" saiu no B-79: com as etiquetas no vetor, todo jogo recomendado tem um
// atributo a favor, e a frase virou o título das prateleiras por jogo.
export const RecommendationReasonSchema = z.object({
  kind: z.literal('features'),
  features: z.array(FeatureLabelSchema).min(1).max(RECOMMENDATION_REASONS_MAX),
});

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
// valores do banco, como o modo, ou uma etiqueta da comunidade Steam (B-78). O título vai em
// "Porque você curte <título>": o do vocabulário das etiquetas ou, sem ele, o nome (B-79).
export const RecommendationFeatureSchema = FeatureLabelSchema.extend({
  type: z.enum(['GENRE', 'THEME', 'TAG']),
  title: z.string().min(1),
});

export type RecommendationFeature = z.infer<typeof RecommendationFeatureSchema>;

// O jogo da biblioteca de "Porque você gostou de <jogo>" (B-79). Pode ter saído do catálogo e vem
// marcado, como na biblioteca.
export const RecommendationLikedGameSchema = LibraryGameSchema.pick({
  slug: true,
  name: true,
  inCatalog: true,
});

export type RecommendationLikedGame = z.infer<typeof RecommendationLikedGameSchema>;

const listItems = {
  items: z.array(RecommendationSchema),
  // A lista completa tem mais jogos que os mostrados.
  hasMore: z.boolean(),
};

// Na visão geral, na ordem da página (por jogo, por interesse e "Em breve"), os itens já vêm sem
// os jogos que apareceram antes.
export const RecommendationShelfSchema = z.discriminatedUnion('kind', [
  z.object({
    key: z.string().regex(/^game:/),
    kind: z.literal('liked-game'),
    feature: z.null(),
    game: RecommendationLikedGameSchema,
    ...listItems,
  }),
  z.object({
    key: z.string().regex(/^(genre|theme|tag):/),
    kind: z.literal('interest'),
    feature: RecommendationFeatureSchema,
    ...listItems,
  }),
  z.object({
    key: z.literal('upcoming'),
    kind: z.literal('upcoming'),
    feature: z.null(),
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

// Uma página de uma lista só, para o "ver mais": main, upcoming, game:<slug>, genre:<slug>,
// theme:<slug> ou tag:<slug>. A base vem como na visão geral, para a página tratar populares e
// vazia (B-72).
export const RecommendationPageSchema = z.object({
  mode: z.enum(DISCOVERY_MODES),
  basis: z.enum(RECOMMENDATION_BASES),
  key: z.string(),
  feature: RecommendationFeatureSchema.nullable(),
  game: RecommendationLikedGameSchema.nullable(),
  page: z.number().int().min(1),
  ...listItems,
});

export type RecommendationPage = z.infer<typeof RecommendationPageSchema>;
