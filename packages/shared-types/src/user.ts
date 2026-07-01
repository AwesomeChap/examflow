export type UserRole = "admin" | "teacher" | "student";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  matriculationNumber: string | null;
  createdAt?: string;
};

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

/** Minimal student shape used by assignment pickers. */
export type Student = {
  id: string;
  name: string;
  email: string;
  matriculationNumber: string | null;
};
