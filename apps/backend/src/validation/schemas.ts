import { z } from "zod";

// ---------- Auth ----------

// Accepts `identifier` (email or matriculation number); `email` is kept as a
// backward-compatible alias.
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((data) => Boolean(data.identifier ?? data.email), {
    message: "identifier (email or matriculation number) is required",
    path: ["identifier"],
  });

export type LoginInput = z.infer<typeof loginSchema>;

// ---------- Exam ----------

export const examCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  durationMin: z.number().int().positive().max(1440).optional(),
  // Scheduled open time; null/omitted means the exam is available immediately.
  startsAt: z.coerce.date().nullish(),
});

export const examUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullish(),
    durationMin: z.number().int().positive().max(1440).optional(),
    startsAt: z.coerce.date().nullish(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export type ExamCreateInput = z.infer<typeof examCreateSchema>;
export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;

// ---------- Question ----------

const questionBase = {
  text: z.string().trim().min(1).max(1000),
  order: z.number().int().positive().optional(),
  points: z.number().int().positive().max(100).optional(),
};

const mcqObject = z.object({
  type: z.literal("mcq"),
  ...questionBase,
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
  correctAnswer: z.string().trim().min(1).max(500),
});

const trueFalseObject = z.object({
  type: z.literal("true_false"),
  ...questionBase,
  options: z.null().optional(),
  correctAnswer: z.enum(["true", "false"]),
});

export const questionCreateSchema = z
  .discriminatedUnion("type", [mcqObject, trueFalseObject])
  .refine((q) => q.type !== "mcq" || q.options.includes(q.correctAnswer), {
    message: "correctAnswer must be one of the provided options",
    path: ["correctAnswer"],
  });

// Partial patch used for updates; the merged result is re-validated with
// `questionCreateSchema` so the final shape always satisfies the DB constraint.
export const questionPatchSchema = z
  .object({
    type: z.enum(["mcq", "true_false"]).optional(),
    text: z.string().trim().min(1).max(1000).optional(),
    options: z
      .array(z.string().trim().min(1).max(500))
      .min(2)
      .max(10)
      .nullable()
      .optional(),
    correctAnswer: z.string().trim().min(1).max(500).optional(),
    order: z.number().int().positive().optional(),
    points: z.number().int().positive().max(100).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;
export type QuestionPatchInput = z.infer<typeof questionPatchSchema>;

// ---------- Exam assignments ----------

export const assignStudentsSchema = z.object({
  studentIds: z.array(z.string().trim().min(1)).min(1).max(500),
});

export type AssignStudentsInput = z.infer<typeof assignStudentsSchema>;

// ---------- Attempts ----------

// A single answer submitted during an attempt. Type-specific validity (the
// value being one of the MCQ options, or "true"/"false") is checked against
// the loaded question in the route, since it depends on DB state.
export const answerUpsertSchema = z.object({
  value: z.string().trim().min(1).max(500),
});

export type AnswerUpsertInput = z.infer<typeof answerUpsertSchema>;
