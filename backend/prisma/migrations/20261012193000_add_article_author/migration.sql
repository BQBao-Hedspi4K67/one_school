ALTER TABLE "Article"
  ADD COLUMN "authorId" TEXT;

CREATE INDEX "Article_authorId_updatedAt_idx"
  ON "Article"("authorId", "updatedAt");

ALTER TABLE "Article"
  ADD CONSTRAINT "Article_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
