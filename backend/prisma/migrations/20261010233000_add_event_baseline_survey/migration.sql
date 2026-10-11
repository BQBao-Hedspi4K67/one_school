ALTER TABLE "Event" ADD COLUMN "baselineSurveyId" TEXT;

UPDATE "Event"
SET "baselineSurveyId" = (
  SELECT "id" FROM "Survey"
  WHERE "Survey"."type" = 'BASELINE'
    AND "Survey"."eventId" IS NULL
  ORDER BY "Survey"."createdAt" ASC
  LIMIT 1
)
WHERE "baselineSurveyId" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "baselineSurveyId" SET NOT NULL;
CREATE INDEX "Event_baselineSurveyId_idx" ON "Event"("baselineSurveyId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_baselineSurveyId_fkey"
  FOREIGN KEY ("baselineSurveyId") REFERENCES "Survey"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
