import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { ExamStatus, PrismaClient, UserRole } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
const teacherPassword = process.env.SEED_TEACHER_PASSWORD ?? "teacher123";
const studentPassword = process.env.SEED_STUDENT_PASSWORD ?? "student123";

// Domains used by seeded accounts (current + legacy) so reseeding removes any
// stale rows whose email changed, instead of leaving orphans behind.
const SEED_EMAIL_DOMAINS = [
  "@examflow.edu",
  "@stud.examflow.edu",
  "@domain.edu",
  "@examflow.local",
];

async function main() {
  const seedUserFilter = {
    OR: SEED_EMAIL_DOMAINS.map((domain) => ({ email: { endsWith: domain } })),
  };

  // Users can't be deleted while they're still referenced by exams/attempts
  // (Exam.createdById and Attempt.userId both RESTRICT deletes). Clear those
  // dependents first so re-running the seed is idempotent. Deleting the exams
  // cascades to their questions, assignments, and attempts.
  const existingSeedUsers = await prisma.user.findMany({
    where: seedUserFilter,
    select: { id: true },
  });
  const seedUserIds = existingSeedUsers.map((user) => user.id);
  if (seedUserIds.length > 0) {
    await prisma.attempt.deleteMany({ where: { userId: { in: seedUserIds } } });
    await prisma.exam.deleteMany({ where: { createdById: { in: seedUserIds } } });
  }

  await prisma.user.deleteMany({ where: seedUserFilter });

  const [adminHash, teacherHash, studentHash] = await Promise.all([
    bcrypt.hash(adminPassword, SALT_ROUNDS),
    bcrypt.hash(teacherPassword, SALT_ROUNDS),
    bcrypt.hash(studentPassword, SALT_ROUNDS),
  ]);

  const users = [
    {
      name: "Admin",
      email: "admin@examflow.edu",
      role: UserRole.admin,
      passwordHash: adminHash,
      matriculationNumber: null,
    },
    {
      name: "Jane",
      email: "jane@examflow.edu",
      role: UserRole.teacher,
      passwordHash: teacherHash,
      matriculationNumber: null,
    },
    {
      name: "Alice",
      email: "alice@stud.examflow.edu",
      role: UserRole.student,
      passwordHash: studentHash,
      matriculationNumber: "MAT2024001",
    },
    {
      name: "Bob",
      email: "bob@stud.examflow.edu",
      role: UserRole.student,
      passwordHash: studentHash,
      matriculationNumber: "MAT2024002",
    },
    {
      name: "Carol",
      email: "carol@stud.examflow.edu",
      role: UserRole.student,
      passwordHash: studentHash,
      matriculationNumber: "MAT2024003",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        matriculationNumber: user.matriculationNumber,
      },
      create: user,
    });
  }

  console.log(`Seeded ${users.length} users`);

  await seedDemoExams();
}

// Creates a spread of exams owned by the seeded teacher so the listing UI has
// data to page through (mixed draft/published statuses). Idempotent: removes
// the teacher's existing exams first.
async function seedDemoExams() {
  const teacher = await prisma.user.findUnique({
    where: { email: "jane@examflow.edu" },
    select: { id: true },
  });
  if (!teacher) return;

  await prisma.exam.deleteMany({ where: { createdById: teacher.id } });

  const subjects = [
    "Algebra",
    "Geometry",
    "World History",
    "Organic Chemistry",
    "Cell Biology",
    "Mechanics",
    "Thermodynamics",
    "English Literature",
    "Microeconomics",
    "Data Structures",
    "Operating Systems",
    "Linear Algebra",
  ];

  const exams = subjects.map((subject, index) => ({
    title: `${subject} ${index % 2 === 0 ? "Midterm" : "Final"}`,
    description: `Assessment covering core ${subject.toLowerCase()} topics.`,
    durationMin: 45 + (index % 4) * 15,
    // Alternate statuses so both states are represented in the list.
    status: index % 3 === 0 ? ExamStatus.draft : ExamStatus.published,
    createdById: teacher.id,
  }));

  await prisma.exam.createMany({ data: exams });
  console.log(`Seeded ${exams.length} demo exams`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
