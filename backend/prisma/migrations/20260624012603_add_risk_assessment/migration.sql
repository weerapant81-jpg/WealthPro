-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "riskAnswers" JSONB,
ADD COLUMN     "riskAssessedAt" TIMESTAMP(3),
ADD COLUMN     "riskLabel" TEXT,
ADD COLUMN     "riskLevel" INTEGER,
ADD COLUMN     "riskScore" INTEGER;
