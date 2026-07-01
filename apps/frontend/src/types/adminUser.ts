import type { UserRole } from "./user";

/** A user row as returned by the admin user-management endpoints. */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  matriculationNumber: string | null;
  /** Null = active; an ISO timestamp means the account is deactivated. */
  deactivatedAt: string | null;
  createdAt: string;
};
