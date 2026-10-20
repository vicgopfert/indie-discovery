-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('RELEASED', 'UPCOMING');

-- CreateEnum
CREATE TYPE "StudioCountrySource" AS ENUM ('IGDB', 'WIKIDATA');

-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('GENRE', 'THEME', 'KEYWORD');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Country" (
    "code" INTEGER NOT NULL,
    "alpha2" CHAR(2) NOT NULL,
    "namePt" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" UUID NOT NULL,
    "igdbId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "igdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" INTEGER,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" UUID NOT NULL,
    "type" "FeatureType" NOT NULL,
    "igdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "idf" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "igdbId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "coverImageId" TEXT NOT NULL,
    "firstReleaseDate" DATE,
    "releaseStatus" "ReleaseStatus" NOT NULL,
    "popularityRaw" INTEGER NOT NULL DEFAULT 0,
    "popularityNorm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isIndie" BOOLEAN NOT NULL,
    "storeUrl" TEXT,
    "studioCountryCode" INTEGER,
    "studioCountrySource" "StudioCountrySource",
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCompany" (
    "gameId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "isDeveloper" BOOLEAN NOT NULL DEFAULT false,
    "isPublisher" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameCompany_pkey" PRIMARY KEY ("gameId","companyId")
);

-- CreateTable
CREATE TABLE "GameFeature" (
    "gameId" UUID NOT NULL,
    "featureId" UUID NOT NULL,
    "tfidfWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "GameFeature_pkey" PRIMARY KEY ("gameId","featureId")
);

-- CreateTable
CREATE TABLE "GameLanguage" (
    "gameId" UUID NOT NULL,
    "languageId" UUID NOT NULL,
    "interface" BOOLEAN NOT NULL DEFAULT false,
    "subtitles" BOOLEAN NOT NULL DEFAULT false,
    "audio" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameLanguage_pkey" PRIMARY KEY ("gameId","languageId")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "IngestionStatus" NOT NULL DEFAULT 'RUNNING',
    "gamesFetched" INTEGER NOT NULL DEFAULT 0,
    "gamesUpserted" INTEGER NOT NULL DEFAULT 0,
    "gamesRejected" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_alpha2_key" ON "Country"("alpha2");

-- CreateIndex
CREATE UNIQUE INDEX "Language_igdbId_key" ON "Language"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_igdbId_key" ON "Company"("igdbId");

-- CreateIndex
CREATE INDEX "Company_countryCode_idx" ON "Company"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_type_igdbId_key" ON "Feature"("type", "igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_igdbId_key" ON "Game"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Game_isIndie_releaseStatus_idx" ON "Game"("isIndie", "releaseStatus");

-- CreateIndex
CREATE INDEX "Game_studioCountryCode_idx" ON "Game"("studioCountryCode");

-- CreateIndex
CREATE INDEX "GameFeature_featureId_idx" ON "GameFeature"("featureId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_studioCountryCode_fkey" FOREIGN KEY ("studioCountryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCompany" ADD CONSTRAINT "GameCompany_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCompany" ADD CONSTRAINT "GameCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFeature" ADD CONSTRAINT "GameFeature_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFeature" ADD CONSTRAINT "GameFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLanguage" ADD CONSTRAINT "GameLanguage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLanguage" ADD CONSTRAINT "GameLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;
