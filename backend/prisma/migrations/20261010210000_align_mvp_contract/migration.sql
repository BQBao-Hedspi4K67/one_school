-- Align the persisted model with the Phase 0 survey and aggregate-scoring contract.
ALTER TYPE "SurveyType" RENAME VALUE 'PRE' TO 'BASELINE';
ALTER TYPE "SurveyType" RENAME VALUE 'POST' TO 'POST_EVENT';

ALTER TABLE "Survey"
  ALTER COLUMN "eventId" DROP NOT NULL;

ALTER TABLE "Response"
  ALTER COLUMN "eventId" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Question"
    WHERE "criterionId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot require Question.criterionId: existing questions are missing a criterion';
  END IF;
END $$;

ALTER TABLE "Question"
  ALTER COLUMN "criterionId" SET NOT NULL;

ALTER TABLE "SatisfactionScore"
  ADD COLUMN "surveyId" TEXT,
  ADD COLUMN "campus" "Campus";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SatisfactionScore"
    WHERE "surveyId" IS NULL OR "campus" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate existing SatisfactionScore rows without survey and campus mappings';
  END IF;
END $$;

ALTER TABLE "SatisfactionScore"
  ALTER COLUMN "eventId" DROP NOT NULL,
  ALTER COLUMN "surveyId" SET NOT NULL,
  ALTER COLUMN "campus" SET NOT NULL;

ALTER TABLE "SatisfactionScore"
  DROP CONSTRAINT "SatisfactionScore_studentId_fkey";

ALTER TABLE "SatisfactionScore"
  DROP COLUMN "studentId";

ALTER TABLE "SatisfactionScore"
  ADD CONSTRAINT "SatisfactionScore_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SatisfactionScore_surveyId_campus_key"
  ON "SatisfactionScore"("surveyId", "campus");

CREATE INDEX "SatisfactionScore_surveyId_campus_calculatedAt_idx"
  ON "SatisfactionScore"("surveyId", "campus", "calculatedAt");

ALTER TABLE "Question"
  DROP CONSTRAINT "Question_criterionId_fkey";

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_criterionId_fkey"
    FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
