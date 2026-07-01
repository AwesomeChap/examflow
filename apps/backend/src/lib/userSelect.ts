/**
 * Shared Prisma `select` shapes for user rows, so every endpoint that returns a
 * user exposes an identical set of columns (and never the password hash).
 */

/** Full management view: everything safe to expose about an account. */
export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  matriculationNumber: true,
  deactivatedAt: true,
  createdAt: true,
} as const;

/** Minimal student view used by assignment pickers and listings. */
export const studentPublicSelect = {
  id: true,
  name: true,
  email: true,
  matriculationNumber: true,
} as const;
