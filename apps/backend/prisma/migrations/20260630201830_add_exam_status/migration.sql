-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "status" "ExamStatus" NOT NULL DEFAULT 'draft';
