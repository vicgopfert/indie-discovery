-- Data com que a execução avaliou o catálogo. As execuções anteriores avaliaram no início.
ALTER TABLE "IngestionRun" ADD COLUMN "evaluatedAt" TIMESTAMP(3);
UPDATE "IngestionRun" SET "evaluatedAt" = "startedAt";
ALTER TABLE "IngestionRun" ALTER COLUMN "evaluatedAt" SET NOT NULL;
