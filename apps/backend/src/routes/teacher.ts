import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth, requireStaff } from "../middleware/auth.js";

export const teacherRouter = Router();

// Teacher area: accessible by teachers and admins (admin acts as a superuser).
// Swap `requireStaff` for `requireRole("teacher")` here if you want to lock
// admins out of teacher-specific routes.
teacherRouter.use(requireAuth, requireStaff);

teacherRouter.get("/dashboard", (req: Request, res: Response) => {
  res.json({
    message: `Welcome, ${req.user!.email}`,
    role: req.user!.role,
  });
});
