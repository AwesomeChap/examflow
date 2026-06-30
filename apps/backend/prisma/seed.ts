import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, UserRole } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: "@examflow.local",
      },
    },
  });

  const users = [
    {
      name: "Admin User",
      email: "admin@domain.edu",
      role: UserRole.admin,
      matriculationNumber: null,
    },
    {
      name: "Jane Teacher",
      email: "jane@domain.edu",
      role: UserRole.teacher,
      matriculationNumber: null,
    },
    {
      name: "Alice Student",
      email: "alice@domain.edu",
      role: UserRole.student,
      matriculationNumber: "MAT2024001",
    },
    {
      name: "Bob Student",
      email: "bob@domain.edu",
      role: UserRole.student,
      matriculationNumber: "MAT2024002",
    },
    {
      name: "Carol Student",
      email: "carol@domain.edu",
      role: UserRole.student,
      matriculationNumber: "MAT2024003",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
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
