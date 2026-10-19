CREATE TYPE "ConnectPostStatus" AS ENUM ('PENDING', 'APPROVED');

CREATE TABLE "ConnectGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConnectGroup_name_key" ON "ConnectGroup"("name");
CREATE INDEX "ConnectGroup_createdAt_idx" ON "ConnectGroup"("createdAt");

CREATE TABLE "ConnectMembership" (
  "groupId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectMembership_pkey" PRIMARY KEY ("groupId", "studentId")
);
CREATE INDEX "ConnectMembership_studentId_idx" ON "ConnectMembership"("studentId");
ALTER TABLE "ConnectMembership" ADD CONSTRAINT "ConnectMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConnectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectMembership" ADD CONSTRAINT "ConnectMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ConnectPost" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "imageUrl" TEXT,
  "status" "ConnectPostStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConnectPost_groupId_status_createdAt_idx" ON "ConnectPost"("groupId", "status", "createdAt");
CREATE INDEX "ConnectPost_authorId_createdAt_idx" ON "ConnectPost"("authorId", "createdAt");
ALTER TABLE "ConnectPost" ADD CONSTRAINT "ConnectPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConnectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectPost" ADD CONSTRAINT "ConnectPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectPost" ADD CONSTRAINT "ConnectPost_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ConnectComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConnectComment_postId_createdAt_idx" ON "ConnectComment"("postId", "createdAt");
ALTER TABLE "ConnectComment" ADD CONSTRAINT "ConnectComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ConnectPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectComment" ADD CONSTRAINT "ConnectComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ConnectReaction" (
  "postId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL DEFAULT '❤️',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectReaction_pkey" PRIMARY KEY ("postId", "studentId")
);
CREATE INDEX "ConnectReaction_studentId_idx" ON "ConnectReaction"("studentId");
ALTER TABLE "ConnectReaction" ADD CONSTRAINT "ConnectReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ConnectPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectReaction" ADD CONSTRAINT "ConnectReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ConnectGroup" ("id", "name", "description", "updatedAt") VALUES
('connect-so-hoc-duong', 'CLB Số học đường', 'Cùng khám phá những con số và bài toán thú vị.', CURRENT_TIMESTAMP),
('connect-van-hoc', 'Em yêu Văn học', 'Chia sẻ sách hay, cảm nhận và những trang viết của em.', CURRENT_TIMESTAMP),
('connect-toan-hoc', 'Toán học tuổi trẻ', 'Thử sức với câu đố và ý tưởng toán học.', CURRENT_TIMESTAMP),
('connect-english', 'English Corner', 'Practice English and share ideas together.', CURRENT_TIMESTAMP),
('connect-stem', 'STEM', 'Khám phá khoa học, công nghệ, kỹ thuật và sáng tạo.', CURRENT_TIMESTAMP),
('connect-the-thao', 'Thể thao', 'Chia sẻ niềm vui vận động và tinh thần đồng đội.', CURRENT_TIMESTAMP),
('connect-am-nhac-nghe-thuat', 'Âm nhạc – Nghệ thuật', 'Âm nhạc, mỹ thuật và những sáng tạo của học sinh.', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
