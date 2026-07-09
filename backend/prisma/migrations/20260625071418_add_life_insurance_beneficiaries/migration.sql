-- CreateTable
CREATE TABLE "LifeInsuranceBeneficiary" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "sharePercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeInsuranceBeneficiary_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LifeInsuranceBeneficiary" ADD CONSTRAINT "LifeInsuranceBeneficiary_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LifeInsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
