ALTER TABLE "Survey" ADD COLUMN "teacherId" TEXT;
UPDATE "Survey"
SET "teacherId" = (SELECT "id" FROM "User" WHERE "role" = 'TEACHER' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "teacherId" IS NULL;
ALTER TABLE "Survey" ALTER COLUMN "teacherId" SET NOT NULL;
CREATE INDEX "Survey_teacherId_idx" ON "Survey"("teacherId");
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
