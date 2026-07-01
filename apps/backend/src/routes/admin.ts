import { Router } from "express";
import type { Request, Response } from "express";
import { hashPassword } from "../lib/auth.js";
import { handleKnownPrismaError, sendError } from "../lib/http.js";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { createProvisionedUser } from "../lib/userProvisioning.js";
import { parseOr400 } from "../lib/validation.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { userCreateSchema, userListQuerySchema } from "../validation/schemas.js";

export const adminRouter = Router();

// Admin-only area: every route under /admin requires an authenticated admin.
adminRouter.use(requireAuth, requireAdmin);

// Fields safe to expose for user management (no password hash).
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  matriculationNumber: true,
  deactivatedAt: true,
  createdAt: true,
} as const;

// System dashboard / stats. Counts reflect *active* users only, since
// deactivated accounts are effectively removed from the platform.
adminRouter.get("/dashboard", async (_req: Request, res: Response) => {
  const [admins, teachers, students, exams] = await Promise.all([
    prisma.user.count({ where: { role: "admin", deactivatedAt: null } }),
    prisma.user.count({ where: { role: "teacher", deactivatedAt: null } }),
    prisma.user.count({ where: { role: "student", deactivatedAt: null } }),
    prisma.exam.count(),
  ]);

  res.json({
    users: { admins, teachers, students },
    exams,
  });
});

// List users, optionally filtered by role, paginated (newest first).
adminRouter.get("/users", async (req: Request, res: Response) => {
  const query = parseOr400(userListQuerySchema, req.query, res);
  if (!query) return;

  const { page, pageSize, role } = query;
  const where = role ? { role } : {};

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: userSelect,
    }),
  ]);

  res.json({ users, total, page, pageSize });
});

// Create a teacher or student. Email (+ matriculation for students) are
// generated server-side; the admin supplies name, role, and initial password.
adminRouter.post("/users", async (req: Request, res: Response) => {
  const data = parseOr400(userCreateSchema, req.body, res);
  if (!data) return;

  try {
    const passwordHash = await hashPassword(data.password);
    const user = await createProvisionedUser({
      name: data.name,
      role: data.role,
      passwordHash,
    });
    res.status(201).json({ user });
  } catch (error) {
    if (handleKnownPrismaError(error, res)) return;
    throw error;
  }
});

// Deactivate (soft-delete) a user. We never hard-delete so identifiers are not
// reused. Admins cannot deactivate themselves or other admins.
adminRouter.delete("/users/:userId", async (req: Request, res: Response) => {
  const userId = param(req, "userId");

  if (userId === req.user!.sub) {
    sendError(res, 400, "You cannot deactivate your own account");
    return;
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) {
    sendError(res, 404, "User not found");
    return;
  }
  if (target.role === "admin") {
    sendError(res, 403, "Admin accounts cannot be deactivated");
    return;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { deactivatedAt: new Date() },
    select: userSelect,
  });
  res.json({ user });
});

// Reactivate a previously deactivated user.
adminRouter.post(
  "/users/:userId/reactivate",
  async (req: Request, res: Response) => {
    const userId = param(req, "userId");
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) {
      sendError(res, 404, "User not found");
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { deactivatedAt: null },
      select: userSelect,
    });
    res.json({ user });
  },
);
