-- AlterTable
ALTER TABLE "ClientProfile" ALTER COLUMN "nationality" SET DEFAULT 'เนเธ—เธข';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "carLoanRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "homeLoanRate" DOUBLE PRECISION NOT NULL DEFAULT 6.0;
