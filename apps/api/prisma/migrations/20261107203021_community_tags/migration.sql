-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('STEAM', 'IGDB');

-- AlterEnum
ALTER TYPE "FeatureType" ADD VALUE 'TAG';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "steamAppId" INTEGER,
ADD COLUMN     "tagSource" "TagSource";

-- AlterTable
ALTER TABLE "GameFeature" ADD COLUMN     "rank" SMALLINT;
