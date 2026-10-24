-- O jogo passa a guardar a contagem reconstruída (pessoas), que não muda quando a base de
-- usuários da IGDB cresce; a unidade fica na execução. A conversão usa a unidade da última
-- execução bem-sucedida.
ALTER TABLE "Game" ADD COLUMN "popularityCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Game" g SET "popularityCount" = round(g."popularityRaw" / r."popularityUnit")::int
FROM (
  SELECT "popularityUnit" FROM "IngestionRun"
  WHERE "status" = 'SUCCEEDED' AND "popularityUnit" > 0
  ORDER BY "startedAt" DESC LIMIT 1
) AS r
WHERE g."popularityRaw" > 0;

ALTER TABLE "Game" DROP COLUMN "popularityRaw";
