import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const adminRouter = Router();

// Admin-only area: every route under /admin requires an authenticated admin.
adminRouter.use(requireAuth, requireAdmin);

// System dashboard / stats.
adminRouter.get("/dashboard", async (_req: Request, res: Response) => {
  const [admins, teachers, students, exams] = await Promise.all([
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "teacher" } }),
    prisma.user.count({ where: { role: "student" } }),
    prisma.exam.count(),
  ]);

  res.json({
    users: { admins, teachers, students },
    exams,
  });
});

// List all users.
adminRouter.get("/users", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      matriculationNumber: true,
    },
  });

  res.json({ users });
});
