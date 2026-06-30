import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createUser, prisma } from "./helpers.js";

/**
 * Student dashboard (`GET /student/dashboard`) and the exam start-time gate.
 *
 * Exams may have a scheduled `startsAt`; until then a student can see the exam
 * on their dashboard (locked) but cannot start an attempt.
 */
describe("student dashboard + start-time gating", () => {
  const tag = randomUUID().slice(0, 8);
  let studentId: string;
  let teacherId: string;
  let studentAgent: Awaited<ReturnType<typeof agentFor>>;
  let teacherAgent: Awaited<ReturnType<typeof agentFor>>;
  const userIds: string[] = [];

  const HOUR = 60 * 60 * 1000;

  before(async () => {
    const teacher = await createUser({
      name: "Sched Teacher",
      email: `sd-teacher-${tag}@domain.edu`,
      role: "teacher",
    });
    const student = await createUser({
      name: "Sched Student",
      email: `sd-student-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `SD${tag}`,
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

  // Creates an exam (one MCQ) optionally scheduled, and assigns the student.
  async function makeExam(startsAt: Date | null) {
    const exam = await prisma.exam.create({
      data: {
        title: `Sched Exam ${randomUUID().slice(0, 8)}`,
        createdById: teacherId,
        durationMin: 60,
        startsAt,
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

  describe("access control", () => {
    it("forbids staff from the student dashboard (403)", async () => {
      const res = await teacherAgent.get("/student/dashboard");
      assert.equal(res.status, 403);
    });

    it("requires authentication (401)", async () => {
      const res = await request(app).get("/student/dashboard");
      assert.equal(res.status, 401);
    });
  });

  describe("dashboard contents", () => {
    it("lists assigned exams with availability + attempt status", async () => {
      const open = await makeExam(null);
      const future = await makeExam(new Date(Date.now() + 2 * HOUR));

      const res = await studentAgent.get("/student/dashboard");
      assert.equal(res.status, 200);

      const byId = Object.fromEntries(
        res.body.exams.map((e: { id: string }) => [e.id, e]),
      );

      // Immediately-available exam.
      assert.equal(byId[open.id].isOpen, true);
      assert.equal(byId[open.id].startsInMs, null);
      assert.equal(byId[open.id].attemptStatus, "not_started");
      assert.equal(byId[open.id].totalQuestions, 1);

      // Scheduled exam is visible but locked until its start time.
      assert.equal(byId[future.id].isOpen, false);
      assert.ok(byId[future.id].startsInMs > 0);
      assert.equal(byId[future.id].attemptStatus, "not_started");
    });

    it("reflects in-progress and submitted attempt status", async () => {
      const exam = await makeExam(null);
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      let res = await studentAgent.get("/student/dashboard");
      let entry = res.body.exams.find((e: { id: string }) => e.id === exam.id);
      assert.equal(entry.attemptStatus, "in_progress");
      assert.equal(entry.score, null);

      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);
      res = await studentAgent.get("/student/dashboard");
      entry = res.body.exams.find((e: { id: string }) => e.id === exam.id);
      assert.equal(entry.attemptStatus, "submitted");
      assert.equal(entry.score, 0); // nothing answered
    });
  });

  describe("start-time gating", () => {
    it("blocks starting an attempt before the start time (403)", async () => {
      const exam = await makeExam(new Date(Date.now() + 2 * HOUR));
      const res = await studentAgent.post(`/exams/${exam.id}/attempt`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /not started/i);
      assert.ok(res.body.startsAt, "expected startsAt in the error body");
    });

    it("allows starting once the start time has passed", async () => {
      const exam = await makeExam(new Date(Date.now() - 1 * HOUR));
      const res = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 201);
    });

    it("allows starting when no start time is set", async () => {
      const exam = await makeExam(null);
      const res = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 201);
    });
  });

  describe("scheduling via the exam API", () => {
    it("accepts startsAt on exam creation", async () => {
      const when = new Date(Date.now() + 3 * HOUR).toISOString();
      const res = await teacherAgent
        .post("/exams")
        .send({ title: "Scheduled", startsAt: when });

      assert.equal(res.status, 201);
      assert.equal(new Date(res.body.exam.startsAt).toISOString(), when);
    });
  });
});
