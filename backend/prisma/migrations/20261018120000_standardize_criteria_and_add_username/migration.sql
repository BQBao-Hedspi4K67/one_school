ALTER TABLE "User" ADD COLUMN "username" TEXT;

DO $$
DECLARE
  user_row RECORD;
  base_username TEXT;
  candidate_username TEXT;
  suffix INTEGER;
BEGIN
  FOR user_row IN
    SELECT "id", "email"
    FROM "User"
    ORDER BY "createdAt", "id"
  LOOP
    base_username := trim(both '-_.' from left(
      lower(regexp_replace(split_part(user_row."email", '@', 1), '[^a-z0-9._-]+', '-', 'g')),
      32
    ));
    IF base_username = '' THEN
      base_username := 'user-' || left(user_row."id", 20);
    END IF;

    candidate_username := base_username;
    suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM "User" WHERE "username" = candidate_username
    ) LOOP
      suffix := suffix + 1;
      candidate_username := left(
        base_username,
        32 - char_length(suffix::TEXT) - 1
      ) || '-' || suffix::TEXT;
    END LOOP;

    UPDATE "User"
    SET "username" = candidate_username
    WHERE "id" = user_row."id";
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

UPDATE "Criterion" AS criterion
SET
  "name" = CASE criterion."order"
    WHEN 1 THEN 'Mức độ tham gia'
    WHEN 2 THEN 'Mức độ kết nối'
    WHEN 3 THEN 'Cảm giác thuộc về'
    WHEN 4 THEN 'Công bằng và hài lòng'
  END,
  "description" = CASE criterion."order"
    WHEN 1 THEN 'Mức độ học sinh có cơ hội và chủ động tham gia các hoạt động.'
    WHEN 2 THEN 'Mức độ giao lưu, tương tác và kết nối giữa học sinh hai cơ sở.'
    WHEN 3 THEN 'Mức độ học sinh cảm thấy được chào đón, tôn trọng và thuộc về cộng đồng.'
    WHEN 4 THEN 'Mức độ công bằng trong cơ hội tham gia và sự hài lòng chung của học sinh.'
  END,
  "weight" = 1,
  "isScored" = TRUE
FROM "Survey" AS survey
WHERE criterion."surveyId" = survey."id"
  AND survey."type" = 'POST_EVENT'
  AND criterion."order" BETWEEN 1 AND 4;
