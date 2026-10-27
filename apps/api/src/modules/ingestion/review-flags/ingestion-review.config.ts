import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { hasUniqueIds, igdbEntity, type IndieCriteria } from '../criteria/indie-criteria.config';

const reviewedCompany = igdbEntity
  .extend({
    decision: z.enum([
      'no_current_effect',
      'wrong_igdb_parent',
      'wrong_credit',
      'rejected',
      'not_ownership',
      'pending_source',
    ]),
    decidedAt: z.iso.date(),
    group: z.string().min(1).optional(),
    acquiredYear: z.number().int().optional(),
    note: z.string().min(1).optional(),
  })
  .refine((c) => c.decision !== 'no_current_effect' || (c.group && c.acquiredYear), {
    message: 'Estúdio sem efeito atual precisa do grupo e do ano da compra.',
  });

const reviewedGame = igdbEntity.extend({
  decidedAt: z.iso.date(),
  note: z.string().min(1),
});

// O que só alimenta os alertas de revisão: mudar este arquivo não muda nenhum veredito, por isso
// ele fica fora da versão do critério.
export const ingestionReviewSchema = z.object({
  reviewedCompaniesPolicy: z.string().min(1),
  reviewedCompanies: z.array(reviewedCompany).refine(hasUniqueIds, {
    message: 'Empresa repetida na lista de empresas revisadas.',
  }),
  noDeveloperReview: z.object({
    minRatings: z.number().int().positive(),
    rationale: z.string().min(1),
    reviewedGames: z.array(reviewedGame).refine(hasUniqueIds, {
      message: 'Jogo repetido na lista de jogos sem desenvolvedora revisados.',
    }),
  }),
});

export type IngestionReview = z.infer<typeof ingestionReviewSchema>;

export const INGESTION_REVIEW_FILE = resolve(process.cwd(), 'config/ingestion-review.json');

// Lido junto com o critério: uma empresa revisada não pode ser também grande nem controlada.
export function readIngestionReview(
  criteria: IndieCriteria,
  file = INGESTION_REVIEW_FILE,
): IngestionReview {
  const review = ingestionReviewSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  const conflicting = review.reviewedCompanies.filter(
    (c) =>
      criteria.majorCompanies.some((m) => m.igdbId === c.igdbId) ||
      criteria.controlledStudios.some((s) => s.igdbId === c.igdbId),
  );
  if (conflicting.length > 0) {
    throw new Error(
      'Empresa revisada não pode estar também na lista de grandes ou de controlados: ' +
        conflicting.map((c) => `${c.name} (${c.igdbId})`).join(', '),
    );
  }
  return review;
}
