-- AlterTable: configurable attempt limit (null = unlimited). Existing exams
-- keep the previous single-attempt behaviour.
ALTER TABLE "Exam" ADD COLUMN "maxAttempts" INTEGER DEFAULT 1;

-- Allow multiple attempts per (student, exam): drop the one-attempt uniqueness.
DROP INDEX "Attempt_userId_examId_key";

-- Replace it with a plain composite index for per-student, per-exam lookups.
CREATE INDEX "Attempt_userId_examId_idx" ON "Attempt"("userId", "examId");
