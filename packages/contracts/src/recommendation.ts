import { z } from 'zod';
import { DISCOVERY_MODES } from './auth';
import { FeatureLabelSchema, GameSummarySchema, positiveInt } from './catalog';
import { LibraryGameSchema } from './library';

export const RECOMMENDATIONS_LIMIT_DEFAULT = 20;
export const RECOMMENDATIONS_LIMIT_MAX = 50;
export const RECOMMENDATION_REASONS_MAX = 3;

export type DiscoveryMode = (typeof DISCOVERY_MODES)[number];

// Na URL o modo vai em minúsculas, como os outros parâmetros; a resposta usa os valores do banco.
export const MODE_PARAMS = {
  popular: 'POPULAR',
  balanced: 'BALANCED',
  discovery: 'DISCOVERY',
} as const satisfies Record<string, DiscoveryMode>;

// Sem modo, vale o salvo no usuário: a consulta não grava a escolha, quem grava é o PATCH /me.
export const RecommendationQuerySchema = z.object({
  mode: z
    .enum(Object.keys(MODE_PARAMS) as [keyof typeof MODE_PARAMS], {
      error: 'Modo deve ser popular, balanced ou discovery.',
    })
    .transform((mode) => MODE_PARAMS[mode])
    .optional(),
  limit: positiveInt(RECOMMENDATIONS_LIMIT_MAX, 'O limite').default(RECOMMENDATIONS_LIMIT_DEFAULT),
});

export type RecommendationQuery = z.output<typeof RecommendationQuerySchema>;

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
  // Só no modo Descobertas: o jogo ficaria fora da lista se a ordem fosse só pela similaridade.
  lowKnown: z.boolean(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// profile: pelo perfil; popular: o perfil não tem nenhum atributo a favor, e a lista é dos mais
// populares; empty: sem avaliações, listas nem preferências, o jogador vai para a partida a frio.
export const RECOMMENDATION_BASES = ['profile', 'popular', 'empty'] as const;

export const RecommendationListSchema = z.object({
  mode: z.enum(DISCOVERY_MODES),
  basis: z.enum(RECOMMENDATION_BASES),
  items: z.array(RecommendationSchema),
});

export type RecommendationList = z.infer<typeof RecommendationListSchema>;
