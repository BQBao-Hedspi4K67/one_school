-- CreateEnum
CREATE TYPE "Campus" AS ENUM ('MAIN', 'BRANCH');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'OPEN_TEXT';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "deliveryMode" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "targetCampuses" "Campus"[],
ADD COLUMN     "targetGrades" TEXT[];

-- AlterTable
ALTER TABLE "EventParticipant" ADD COLUMN     "status" "RegistrationStatus" NOT NULL DEFAULT 'REQUESTED';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "criterionId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "campus" "Campus";

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "weight" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "isScored" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "surveyId" TEXT,
    "authorId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inputAggregate" JSONB NOT NULL,
    "output" JSONB,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_surveyId_order_key" ON "Criterion"("surveyId", "order");

-- CreateIndex
CREATE INDEX "AiAnalysis_eventId_kind_createdAt_idx" ON "AiAnalysis"("eventId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_surveyId_kind_createdAt_idx" ON "AiAnalysis"("surveyId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_status_idx" ON "EventParticipant"("eventId", "status");

-- CreateIndex
CREATE INDEX "Question_criterionId_idx" ON "Question"("criterionId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
