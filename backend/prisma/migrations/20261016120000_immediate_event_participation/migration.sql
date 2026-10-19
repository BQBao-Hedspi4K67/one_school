UPDATE "EventParticipant"
SET "status" = 'CONFIRMED'
WHERE "status" = 'REQUESTED';

ALTER TABLE "EventParticipant"
ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
