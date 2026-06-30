import "dotenv/config";
import { defineConfig } from "prisma/config";

// Read DATABASE_URL via process.env (not Prisma's `env()` helper) so that
// commands which don't need a DB connection — notably `prisma generate` run by
// the `postinstall` hook during `npm ci` in CI — don't fail when the variable
// is absent. Commands that do connect (migrate/seed) still require it at runtime.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
