ALTER TABLE "ConnectComment"
ADD COLUMN "parentId" TEXT;

CREATE INDEX "ConnectComment_parentId_createdAt_idx"
ON "ConnectComment"("parentId", "createdAt");

ALTER TABLE "ConnectComment"
ADD CONSTRAINT "ConnectComment_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "ConnectComment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
