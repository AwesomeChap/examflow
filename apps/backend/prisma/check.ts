import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const violations: string[] = [];

async function main() {
  const [users, exams, questions, attempts, answers] = await Promise.all([
    prisma.user.count(),
    prisma.exam.count(),
    prisma.question.count(),
    prisma.attempt.count(),
    prisma.answer.count(),
  ]);

  console.log("Database connection OK");
  console.log(`  Users:     ${users}`);
  console.log(`  Exams:     ${exams}`);
  console.log(`  Questions: ${questions}`);
  console.log(`  Attempts:  ${attempts}`);
  console.log(`  Answers:   ${answers}`);

  const allUsers = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      name: true,
      email: true,
      role: true,
      matriculationNumber: true,
    },
  });

  console.log("\nUsers:");
  for (const user of allUsers) {
    const matric = user.matriculationNumber ?? "—";
    console.log(`  ${user.email} (${user.role}) matric: ${matric}`);

    if (user.role !== "student" && user.matriculationNumber !== null) {
      violations.push(
        `${user.email}: matriculationNumber must be null for ${user.role}`,
      );
    }
  }

  const attemptsWithoutUser = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Attempt" a
    LEFT JOIN "User" u ON u.id = a."userId"
    WHERE u.id IS NULL
  `;
  if (attemptsWithoutUser[0]?.count > 0n) {
    violations.push(`${attemptsWithoutUser[0].count} attempt(s) with missing user`);
  }

  const answersWithoutQuestion = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Answer" a
    LEFT JOIN "Question" q ON q.id = a."questionId"
    WHERE q.id IS NULL
  `;
  if (answersWithoutQuestion[0]?.count > 0n) {
    violations.push(
      `${answersWithoutQuestion[0].count} answer(s) with missing question`,
    );
  }

  const invalidQuestions = await prisma.$queryRaw<
    { id: string; type: string; issue: string }[]
  >`
    SELECT
      q.id,
      q.type::text,
      CASE
        WHEN q.type = 'mcq' AND (
          q.options IS NULL
          OR jsonb_typeof(q.options) <> 'array'
          OR jsonb_array_length(q.options) < 2
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(q.options) opt
            WHERE opt = q."correctAnswer"
          )
        ) THEN 'mcq must have options array (2+) containing correctAnswer'
        WHEN q.type = 'true_false' AND (
          q.options IS NOT NULL
          OR q."correctAnswer" NOT IN ('true', 'false')
        ) THEN 'true_false must have null options and correctAnswer true|false'
        ELSE NULL
      END AS issue
    FROM "Question" q
  `;

  for (const question of invalidQuestions) {
    if (question.issue) {
      violations.push(`${question.id} (${question.type}): ${question.issue}`);
    }
  }

  if (violations.length > 0) {
    console.error("\nConsistency violations:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log("\nAll consistency checks passed.");
}

main()
  .catch((error) => {
    console.error("Database check failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
