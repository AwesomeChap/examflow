/** GET /admin/dashboard */
export type AdminDashboard = {
  users: { admins: number; teachers: number; students: number };
  exams: number;
};
