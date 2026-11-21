-- AlterEnum
ALTER TYPE "AccountTokenPurpose" ADD VALUE 'EMAIL_CONFIRMATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailConfirmedAt" TIMESTAMP(3);
