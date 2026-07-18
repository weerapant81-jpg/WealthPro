-- CreateTable
CREATE TABLE "GameLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "career" TEXT,
    "score" INTEGER,
    "grade" TEXT,
    "result" JSONB,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameLead_createdAt_idx" ON "GameLead"("createdAt");

