-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "nickname" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationalId" TEXT,
    "maritalStatus" TEXT,
    "nationality" TEXT DEFAULT 'ไทย',
    "occupation" TEXT,
    "jobTitle" TEXT,
    "workYears" DOUBLE PRECISION,
    "salary" DOUBLE PRECISION,
    "salaryIncreaseRate" DOUBLE PRECISION,
    "company" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "contactEmail" TEXT,
    "contactChannel" TEXT,
    "spouseName" TEXT,
    "spouseAge" INTEGER,
    "spouseOccupation" TEXT,
    "spouseIncome" DOUBLE PRECISION,
    "fatherAge" INTEGER,
    "motherAge" INTEGER,
    "parentCareExpense" DOUBLE PRECISION,
    "dependents" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "school" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
