-- CreateTable
CREATE TABLE "FinancialAdviceRule" (
    "id" TEXT NOT NULL,
    "ratioKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "advice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAdviceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAdviceRule_ratioKey_state_key" ON "FinancialAdviceRule"("ratioKey", "state");
