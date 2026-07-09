-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "giMedicalLimit" DOUBLE PRECISION,
ADD COLUMN     "giOpdLimit" DOUBLE PRECISION,
ADD COLUMN     "giRoomLimit" DOUBLE PRECISION,
ADD COLUMN     "giSurgeryLimit" DOUBLE PRECISION,
ADD COLUMN     "hasGroupInsurance" BOOLEAN DEFAULT false,
ADD COLUMN     "hasPVD" BOOLEAN DEFAULT false,
ADD COLUMN     "hasSocialSecurity" BOOLEAN DEFAULT false,
ADD COLUMN     "pvdEmployeeRate" DOUBLE PRECISION,
ADD COLUMN     "pvdEmployerRate" DOUBLE PRECISION,
ADD COLUMN     "socialSecurityYears" DOUBLE PRECISION;
