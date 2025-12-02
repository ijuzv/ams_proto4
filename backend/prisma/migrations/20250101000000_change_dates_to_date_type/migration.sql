-- Step 1: Remove duplicates before conversion (keep the earliest record)
-- This handles cases where same user has multiple records on same date with different times
DELETE FROM "Attendance" a1
WHERE a1.id NOT IN (
  SELECT MIN(a2.id)
  FROM "Attendance" a2
  GROUP BY a2."userId", DATE(a2."date")
);

-- Step 2: Convert DateTime to DATE
ALTER TABLE "Attendance" ALTER COLUMN "date" TYPE DATE USING DATE("date");

-- AlterTable
ALTER TABLE "LeaveRequest" 
  ALTER COLUMN "fromDate" TYPE DATE USING DATE("fromDate"),
  ALTER COLUMN "toDate" TYPE DATE USING DATE("toDate");

-- AlterTable
ALTER TABLE "Holiday" ALTER COLUMN "date" TYPE DATE USING DATE("date");

-- AlterTable (joiningDate can be NULL, handle it)
ALTER TABLE "User" ALTER COLUMN "joiningDate" TYPE DATE USING CASE WHEN "joiningDate" IS NULL THEN NULL ELSE DATE("joiningDate") END;

