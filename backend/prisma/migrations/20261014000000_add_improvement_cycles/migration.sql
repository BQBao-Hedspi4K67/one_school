CREATE TABLE "ImprovementCycle" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "baselineSurveyId" TEXT NOT NULL,
  "eventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImprovementCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImprovementCycle_baselineSurveyId_key" ON "ImprovementCycle"("baselineSurveyId");
CREATE UNIQUE INDEX "ImprovementCycle_eventId_key" ON "ImprovementCycle"("eventId");
CREATE INDEX "ImprovementCycle_teacherId_createdAt_idx" ON "ImprovementCycle"("teacherId", "createdAt");

INSERT INTO "ImprovementCycle" ("id", "title", "teacherId", "baselineSurveyId", "eventId", "createdAt", "updatedAt")
SELECT 'legacy_' || e."id", e."title", e."teacherId", e."baselineSurveyId", e."id", e."createdAt", CURRENT_TIMESTAMP
FROM "Event" e
WHERE NOT EXISTS (
  SELECT 1 FROM "ImprovementCycle" c WHERE c."eventId" = e."id"
);

ALTER TABLE "ImprovementCycle" ADD CONSTRAINT "ImprovementCycle_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImprovementCycle" ADD CONSTRAINT "ImprovementCycle_baselineSurveyId_fkey"
  FOREIGN KEY ("baselineSurveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImprovementCycle" ADD CONSTRAINT "ImprovementCycle_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
