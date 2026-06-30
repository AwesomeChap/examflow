-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'true_false');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "type" "QuestionType" NOT NULL DEFAULT 'mcq';
ALTER TABLE "Question" ALTER COLUMN "options" DROP NOT NULL;

-- Enforce shape per question type
ALTER TABLE "Question"
ADD CONSTRAINT "Question_type_shape_check"
CHECK (
  (
    "type" = 'mcq'::"QuestionType"
    AND "options" IS NOT NULL
    AND jsonb_typeof("options") = 'array'
    AND jsonb_array_length("options") >= 2
  )
  OR (
    "type" = 'true_false'::"QuestionType"
    AND "options" IS NULL
    AND "correctAnswer" IN ('true', 'false')
  )
);
