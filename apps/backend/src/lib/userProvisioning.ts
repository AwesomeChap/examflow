import { Prisma, type UserRole } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { userPublicSelect } from "./userSelect.js";

// Email domains per role. Students get the dedicated student subdomain so their
// addresses are visually distinct from staff.
const STUDENT_DOMAIN = "@stud.examflow.edu";
const STAFF_DOMAIN = "@examflow.edu";

/** Local-part slug from a display name: first token, lowercased, a-z0-9 only. */
export function emailLocalPart(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const slug = first.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Fall back to a stable token so we never produce an empty local part.
  return slug || "user";
}

function domainForRole(role: UserRole): string {
  return role === "student" ? STUDENT_DOMAIN : STAFF_DOMAIN;
}

/**
 * Generates a unique email for a new account. The base is the name's first
 * token; on collision (against active OR deactivated users, since we never
 * reuse identifiers) it appends an incrementing suffix: alice, alice2, alice3…
 */
export async function generateUniqueEmail(name: string, role: UserRole): Promise<string> {
  const base = emailLocalPart(name);
  const domain = domainForRole(role);

  // Pull every taken local part sharing this base so we can pick the next free
  // suffix in one query rather than probing repeatedly.
  const taken = new Set(
    (
      await prisma.user.findMany({
        where: { email: { startsWith: base, endsWith: domain } },
        select: { email: true },
      })
    ).map((u) => u.email.toLowerCase()),
  );

  let candidate = `${base}${domain}`;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}${suffix}${domain}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Generates the next sequential matriculation number for the current year, e.g.
 * MAT2026001. Counts every student number for the year prefix (active or not)
 * so numbers are never reused.
 */
export async function generateMatriculation(now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `MAT${year}`;
  const count = await prisma.user.count({
    where: { matriculationNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export type CreateUserInput = {
  name: string;
  role: Extract<UserRole, "teacher" | "student">;
  passwordHash: string;
};

/**
 * Creates a user with an auto-generated email (+ matriculation for students).
 * Retries on a unique-constraint race (P2002) by regenerating the colliding
 * identifier, up to a small bound.
 */
export async function createProvisionedUser(input: CreateUserInput) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const email = await generateUniqueEmail(input.name, input.role);
    const matriculationNumber = input.role === "student" ? await generateMatriculation() : null;

    try {
      return await prisma.user.create({
        data: {
          name: input.name,
          email,
          role: input.role,
          passwordHash: input.passwordHash,
          matriculationNumber,
        },
        select: userPublicSelect,
      });
    } catch (error) {
      // On a concurrent insert grabbing the same email/matriculation, loop to
      // recompute the next free identifier; rethrow anything else.
      const isUniqueRace =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueRace || attempt === maxAttempts - 1) throw error;
    }
  }
  // Unreachable: the loop either returns or throws on the final attempt.
  throw new Error("Could not provision a unique user account");
}
