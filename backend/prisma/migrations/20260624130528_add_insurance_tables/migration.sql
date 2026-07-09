-- CreateTable
CREATE TABLE "LifeInsurancePolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insuredPerson" TEXT NOT NULL,
    "policyNumber" TEXT,
    "policyDate" TIMESTAMP(3),
    "sumAssured" DOUBLE PRECISION,
    "insuranceType" TEXT,
    "premium" DOUBLE PRECISION,
    "cashValue" DOUBLE PRECISION,
    "policyAge" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeInsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyInsurance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverageType" TEXT NOT NULL,
    "policyNumber" TEXT,
    "insuranceType" TEXT,
    "coverageAmount" DOUBLE PRECISION,
    "premium" DOUBLE PRECISION,
    "coveragePeriod" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyInsurance_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LifeInsurancePolicy" ADD CONSTRAINT "LifeInsurancePolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInsurance" ADD CONSTRAINT "PropertyInsurance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
