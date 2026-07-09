-- CreateTable
CREATE TABLE "LifeInsuranceRider" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "riderType" TEXT NOT NULL,
    "planName" TEXT,
    "coverageAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeInsuranceRider_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LifeInsuranceRider" ADD CONSTRAINT "LifeInsuranceRider_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LifeInsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
