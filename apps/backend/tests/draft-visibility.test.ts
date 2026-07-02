import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { agentFor, createUser, prisma } from "./helpers.js";

/**
 * Draft exams must be invisible to students until published, even when assigned.
 */
describe("draft exam visibility for students", () => {
  const tag = randomUUID().slice(0, 8);
  let studentId: string;
  let teacherId: string;
  let studentAgent: Awaited<ReturnType<typeof agentFor>>;
  let teacherAgent: Awaited<ReturnType<typeof agentFor>>;
  const userIds: string[] = [];

  before(async () => {
    const teacher = await createUser({
      name: "Draft Teacher",
      email: `draft-teacher-${tag}@domain.edu`,
      role: "teacher",
    });
    const student = await createUser({
      name: "Draft Student",
      email: `draft-student-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `DR${tag}`,
    });
    teacherId = teacher.id;
    studentId = student.id;
    userIds.push(teacher.id, student.id);

    studentAgent = await agentFor(student.email);
    teacherAgent = await agentFor(teacher.email);
  });

  after(async () => {
    await prisma.exam.deleteMany({ where: { createdById: teacherId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function createAssignedDraft() {
    const exam = await prisma.exam.create({
      data: {
        title: `Draft Exam ${randomUUID().slice(0, 8)}`,
        createdById: teacherId,
        durationMin: 60,
        status: "draft",
      },
    });
    await prisma.question.create({
      data: {
        examId: exam.id,
        type: "mcq",
        text: "2 + 2 = ?",
        options: ["3", "4", "5"],
        correctAnswer: "4",
        order: 1,
        points: 1,
      },
    });
    await prisma.examAssignment.create({
      data: { examId: exam.id, studentId },
    });
    return exam;
  }

  it("hides an assigned draft from the student dashboard", async () => {
    const exam = await createAssignedDraft();

    const res = await studentAgent.get("/student/dashboard");
    assert.equal(res.status, 200);
    assert.ok(
      !res.body.exams.some((e: { id: string }) => e.id === exam.id),
      "draft exam must not appear on the student dashboard",
    );
  });

  it("returns 404 when a student reads an assigned draft exam", async () => {
    const exam = await createAssignedDraft();

    const res = await studentAgent.get(`/exams/${exam.id}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Exam not found");
  });

  it("returns 404 when a student starts an attempt on an assigned draft", async () => {
    const exam = await createAssignedDraft();

    const res = await studentAgent.post(`/exams/${exam.id}/attempt`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Exam not found");
  });

  it("omits an assigned draft from GET /exams for students", async () => {
    const exam = await createAssignedDraft();

    const res = await studentAgent.get("/exams");
    assert.equal(res.status, 200);
    assert.ok(
      !res.body.exams.some((e: { id: string }) => e.id === exam.id),
      "draft exam must not appear in the student exam list",
    );
  });

  it("shows the exam after the teacher publishes it", async () => {
    const exam = await createAssignedDraft();

    let dash = await studentAgent.get("/student/dashboard");
    assert.ok(!dash.body.exams.some((e: { id: string }) => e.id === exam.id));

    const publish = await teacherAgent
      .put(`/exams/${exam.id}`)
      .send({ status: "published" });
    assert.equal(publish.status, 200);

    dash = await studentAgent.get("/student/dashboard");
    assert.ok(
      dash.body.exams.some((e: { id: string }) => e.id === exam.id),
      "published exam should appear on the student dashboard",
    );

    const start = await studentAgent.post(`/exams/${exam.id}/attempt`);
    assert.equal(start.status, 201);
  });
});
