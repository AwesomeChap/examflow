import "dotenv/config";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { UserRole } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/auth.js";
import { prisma } from "../src/lib/prisma.js";

export { prisma };

// A single app instance is shared by every test; supertest can drive it
// directly without binding a port.
export const app = createApp();

export const TEST_PASSWORD = "test-pass-123";

type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  matriculationNumber: string | null;
};

export async function createUser(opts: {
  name: string;
  email: string;
  role: UserRole;
  matriculationNumber?: string | null;
  // `null` creates an account without a usable password (cannot log in).
  password?: string | null;
}): Promise<CreatedUser> {
  const passwordHash =
    opts.password === null
      ? null
      : await hashPassword(opts.password ?? TEST_PASSWORD);

  return prisma.user.create({
    data: {
      name: opts.name,
      email: opts.email,
      role: opts.role,
      matriculationNumber: opts.matriculationNumber ?? null,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      matriculationNumber: true,
    },
  });
}

/** Logs in and returns a supertest agent whose cookie jar holds the session. */
export async function agentFor(
  identifier: string,
  password = TEST_PASSWORD,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const res = await agent.post("/auth/login").send({ identifier, password });
  if (res.status !== 200) {
    throw new Error(
      `login failed for ${identifier}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return agent;
}

export type World = Awaited<ReturnType<typeof createWorld>>;

/**
 * Builds an isolated cast of users + exams for RBAC / visibility tests:
 *  - examA owned by teacherA, with one MCQ question; studentX is assigned.
 *  - examB owned by teacherB; nobody is assigned.
 *  - studentY is assigned to nothing.
 *
 * All records use a per-run tag so suites can run against a shared dev DB
 * without colliding, and `cleanup()` removes everything it created.
 */
export async function createWorld() {
  const tag = randomUUID().slice(0, 8);

  const [admin, teacherA, teacherB, studentX, studentY] = await Promise.all([
    createUser({ name: "Admin", email: `admin-${tag}@domain.edu`, role: "admin" }),
    createUser({ name: "Teacher A", email: `ta-${tag}@domain.edu`, role: "teacher" }),
    createUser({ name: "Teacher B", email: `tb-${tag}@domain.edu`, role: "teacher" }),
    createUser({
      name: "Student X",
      email: `sx-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `MATX${tag}`,
    }),
    createUser({
      name: "Student Y",
      email: `sy-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `MATY${tag}`,
    }),
  ]);

  const examA = await prisma.exam.create({
    data: { title: `Exam A ${tag}`, createdById: teacherA.id, status: "published" },
  });
  const examB = await prisma.exam.create({
    data: { title: `Exam B ${tag}`, createdById: teacherB.id },
  });

  await prisma.question.create({
    data: {
      text: "What is 2 + 2?",
      type: "mcq",
      options: ["3", "4", "5"],
      correctAnswer: "4",
      order: 1,
      points: 1,
      examId: examA.id,
    },
  });

  await prisma.examAssignment.create({
    data: { examId: examA.id, studentId: studentX.id },
  });

  const userIds = [admin.id, teacherA.id, teacherB.id, studentX.id, studentY.id];
  const examIds = [examA.id, examB.id];

  async function cleanup() {
    // Delete exams first (cascades questions/assignments/attempts), including
    // any created via the API during a test, then the users.
    await prisma.exam.deleteMany({
      where: { OR: [{ id: { in: examIds } }, { createdById: { in: userIds } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  return { tag, admin, teacherA, teacherB, studentX, studentY, examA, examB, cleanup };
}
