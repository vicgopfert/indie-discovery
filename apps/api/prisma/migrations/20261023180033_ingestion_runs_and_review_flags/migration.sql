-- O catálogo de produção ainda está vazio (a carga é o B-14): as colunas novas podem nascer NOT NULL.
-- CreateEnum
CREATE TYPE "ReviewFlagKind" AS ENUM ('NO_EFFECT_STUDIO', 'PARENT_OUTSIDE_MAJORS', 'PARENT_MAJOR_NOT_CONTROLLED', 'RELEASE_DATE_ASSIGNED', 'VERDICT_CHANGED', 'LEFT_CANDIDATE_SET');

-- AlterTable
ALTER TABLE "Game" RENAME COLUMN "isIndie" TO "inCatalog";
ALTER INDEX "Game_isIndie_releaseStatus_idx" RENAME TO "Game_inCatalog_releaseStatus_idx";

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "criteriaVerdict" JSONB NOT NULL,
ADD COLUMN     "criteriaVersion" TEXT NOT NULL,
ALTER COLUMN "popularityRaw" SET DEFAULT 0,
ALTER COLUMN "popularityRaw" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "IngestionRun" ADD COLUMN     "criteriaVersion" TEXT,
ADD COLUMN     "flagsRaised" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gamesDeactivated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gamesInvalid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "popularityMax" INTEGER,
ADD COLUMN     "popularityMedian" DOUBLE PRECISION,
ADD COLUMN     "popularityUnit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "IngestionReviewFlag" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "kind" "ReviewFlagKind" NOT NULL,
    "igdbId" INTEGER NOT NULL,
    "gameName" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionReviewFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionReviewFlag_runId_idx" ON "IngestionReviewFlag"("runId");

-- CreateIndex
CREATE INDEX "IngestionReviewFlag_kind_idx" ON "IngestionReviewFlag"("kind");

-- AddForeignKey
ALTER TABLE "IngestionReviewFlag" ADD CONSTRAINT "IngestionReviewFlag_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
