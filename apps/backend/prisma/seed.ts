import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaClient, UserRole } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
const teacherPassword = process.env.SEED_TEACHER_PASSWORD ?? "teacher123";
const studentPassword = process.env.SEED_STUDENT_PASSWORD ?? "student123";

async function main() {
  await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: "@examflow.local",
      },
    },
  });

  const [adminHash, teacherHash, studentHash] = await Promise.all([
    bcrypt.hash(adminPassword, SALT_ROUNDS),
    bcrypt.hash(teacherPassword, SALT_ROUNDS),
    bcrypt.hash(studentPassword, SALT_ROUNDS),
  ]);

  const users = [
    {
      name: "Admin User",
      email: "admin@domain.edu",
      role: UserRole.admin,
      passwordHash: adminHash,
      matriculationNumber: null,
    },
    {
      name: "Jane Teacher",
      email: "jane@domain.edu",
      role: UserRole.teacher,
      passwordHash: teacherHash,
      matriculationNumber: null,
    },
    {
      name: "Alice Student",
      email: "alice@domain.edu",
      role: UserRole.student,
      passwordHash: studentHash,
      matriculationNumber: "MAT2024001",
    },
    {
      name: "Bob Student",
      email: "bob@domain.edu",
      role: UserRole.student,
      passwordHash: studentHash,
      matriculationNumber: "MAT2024002",
    },
    {
      name: "Carol Student",
      email: "carol@domain.edu",
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
