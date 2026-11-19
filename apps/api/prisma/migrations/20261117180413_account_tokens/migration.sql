-- CreateEnum
CREATE TYPE "AccountTokenPurpose" AS ENUM ('PASSWORD_RESET');

-- CreateTable
CREATE TABLE "AccountToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "AccountTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountToken_expiresAt_idx" ON "AccountToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_userId_purpose_key" ON "AccountToken"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
