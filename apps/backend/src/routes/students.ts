import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { studentPublicSelect } from "../lib/userSelect.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";

export const studentsRouter = Router();

// Staff (teachers + admins) may list students to assign them to exams.
studentsRouter.use(requireAuth, requireStaff);

// List all student accounts (id + display fields only).
studentsRouter.get("/", async (_req: Request, res: Response) => {
  const students = await prisma.user.findMany({
    where: { role: "student" },
    orderBy: { name: "asc" },
    select: studentPublicSelect,
  });
  res.json({ students });
});
