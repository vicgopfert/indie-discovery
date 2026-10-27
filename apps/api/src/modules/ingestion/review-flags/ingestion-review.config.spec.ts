import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readIndieCriteria, readVersionedIndieCriteria } from '../criteria/indie-criteria.config';
import { readIngestionReview } from './ingestion-review.config';

type Raw = Record<string, unknown> & { reviewedCompanies: Record<string, unknown>[] };

describe('arquivo de revisão da ingestão', () => {
  const criteria = readIndieCriteria();
  const raw = JSON.parse(readFileSync('config/ingestion-review.json', 'utf8')) as Raw;

  function fromCopy(content: unknown) {
    const file = join(mkdtempSync(join(tmpdir(), 'review-')), 'ingestion-review.json');
    writeFileSync(file, JSON.stringify(content));
    return () => readIngestionReview(criteria, file);
  }

  it('lê e valida o arquivo versionado junto com o critério', () => {
    const review = readIngestionReview(criteria);

    expect(review.reviewedCompanies.length).toBeGreaterThan(0);
    expect(review.noDeveloperReview.minRatings).toBe(20);
  });

  it('exige grupo e ano da compra no estúdio sem efeito atual', () => {
    const noEffect = raw.reviewedCompanies.find((c) => c.decision === 'no_current_effect')!;

    expect(
      fromCopy({ ...raw, reviewedCompanies: [{ ...noEffect, acquiredYear: undefined }] }),
    ).toThrow('ano da compra');
  });

  it('recusa empresa revisada que também está na lista de controlados', () => {
    const studio = criteria.controlledStudios[0]!;
    const reviewedStudio = {
      igdbId: studio.igdbId,
      name: studio.name,
      decision: 'rejected',
      decidedAt: '2026-10-23',
    };

    expect(fromCopy({ ...raw, reviewedCompanies: [reviewedStudio] })).toThrow(
      'lista de grandes ou de controlados',
    );
  });
});

// A versão do critério separa "a regra mudou" de "o jogo mudou": revisar uma empresa não pode
// mudá-la, porque ela entra na comparação que decide se o jogo é regravado.
describe('versão do critério', () => {
  const dir = mkdtempSync(join(tmpdir(), 'criteria-version-'));
  const criteriaFile = join(dir, 'indie-criteria.json');
  const reviewFile = join(dir, 'ingestion-review.json');
  const criteriaRaw = JSON.parse(readFileSync('config/indie-criteria.json', 'utf8')) as Record<
    string,
    unknown
  >;
  const reviewRaw = JSON.parse(readFileSync('config/ingestion-review.json', 'utf8')) as Raw;

  beforeEach(() => {
    writeFileSync(criteriaFile, JSON.stringify(criteriaRaw));
    writeFileSync(reviewFile, JSON.stringify(reviewRaw));
  });

  it('não muda quando o arquivo de revisão muda', () => {
    const before = readVersionedIndieCriteria(criteriaFile).version;
    const newCompany = {
      igdbId: 999999,
      name: 'Nova',
      decision: 'rejected',
      decidedAt: '2026-10-27',
    };
    writeFileSync(
      reviewFile,
      JSON.stringify({
        ...reviewRaw,
        reviewedCompanies: [...reviewRaw.reviewedCompanies, newCompany],
      }),
    );

    const versioned = readVersionedIndieCriteria(criteriaFile);
    expect(readIngestionReview(versioned.criteria, reviewFile).reviewedCompanies).toContainEqual(
      newCompany,
    );
    expect(versioned.version).toBe(before);
  });

  it('muda quando o arquivo do critério muda', () => {
    const before = readVersionedIndieCriteria(criteriaFile).version;
    writeFileSync(criteriaFile, JSON.stringify({ ...criteriaRaw, principle: 'outro princípio' }));

    expect(readVersionedIndieCriteria(criteriaFile).version).not.toBe(before);
  });
});
