export type UserRole = "admin" | "teacher" | "student";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  matriculationNumber: string | null;
  createdAt: string;
};
