-- AlterTable: soft-delete marker for user accounts. Null = active; existing
-- users remain active. Deactivated accounts keep their email + matriculation
-- number so those identifiers are never reused.
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
