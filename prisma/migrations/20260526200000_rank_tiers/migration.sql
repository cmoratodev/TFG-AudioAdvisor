-- Rename existing enum and create the new one, mapping legacy values.
ALTER TABLE "User" ALTER COLUMN "level" DROP DEFAULT;

ALTER TYPE "UserLevel" RENAME TO "UserLevel_old";

CREATE TYPE "UserLevel" AS ENUM ('IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'LEGEND');

ALTER TABLE "User" ALTER COLUMN "level" TYPE "UserLevel" USING (
  CASE "level"::text
    WHEN 'NOVICE'   THEN 'IRON'
    WHEN 'PRODUCER' THEN 'SILVER'
    WHEN 'ADVISOR'  THEN 'PLATINUM'
    WHEN 'MASTER'   THEN 'DIAMOND'
    ELSE 'IRON'
  END::"UserLevel"
);

ALTER TABLE "User" ALTER COLUMN "level" SET DEFAULT 'IRON';

DROP TYPE "UserLevel_old";
