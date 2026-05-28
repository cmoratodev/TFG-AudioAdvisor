-- Introduce TrackVersion + scope comments to a specific version.
-- Existing Track rows get an automatic V1 backfilled from their current audio.

CREATE TABLE "TrackVersion" (
  "id"            TEXT     NOT NULL,
  "trackId"       TEXT     NOT NULL,
  "versionNumber" INTEGER  NOT NULL,
  "audioUrl"      TEXT     NOT NULL,
  "duration"      DOUBLE PRECISION NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrackVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackVersion_trackId_versionNumber_key" ON "TrackVersion"("trackId", "versionNumber");
CREATE INDEX "TrackVersion_trackId_idx" ON "TrackVersion"("trackId");

ALTER TABLE "TrackVersion"
  ADD CONSTRAINT "TrackVersion_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill V1 for every existing track using its current audioUrl/duration.
-- gen_random_uuid() requires pgcrypto; cuid-style ids are not available in SQL,
-- so we mint UUIDs which Prisma will read as plain TEXT.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "TrackVersion" ("id", "trackId", "versionNumber", "audioUrl", "duration", "createdAt")
SELECT
  REPLACE(gen_random_uuid()::text, '-', ''),
  t."id",
  1,
  t."audioUrl",
  t."duration",
  t."createdAt"
FROM "Track" t;

-- Comment.versionId: add nullable, backfill from the V1 we just created, then enforce NOT NULL.
ALTER TABLE "Comment" ADD COLUMN "versionId" TEXT;

UPDATE "Comment" c
SET "versionId" = v."id"
FROM "TrackVersion" v
WHERE v."trackId" = c."trackId" AND v."versionNumber" = 1;

ALTER TABLE "Comment" ALTER COLUMN "versionId" SET NOT NULL;

CREATE INDEX "Comment_versionId_idx" ON "Comment"("versionId");

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "TrackVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
