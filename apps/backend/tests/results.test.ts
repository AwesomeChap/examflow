import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createUser, prisma } from "./helpers.js";

/**
 * Exam result processing: the student-facing result endpoint
 * (`GET /exams/:examId/attempt/result`) returns the processed score breakdown
 * for a submitted attempt — total score, achievable max, percentage, and a
 * per-question breakdown — and only after the attempt is finalized.
 */
describe("exam result processing", () => {
  const tag = randomUUID().slice(0, 8);
  let teacherId: string;
  let studentId: string;
  let studentAgent: Awaited<ReturnType<typeof agentFor>>;
  let unassignedAgent: Awaited<ReturnType<typeof agentFor>>;
  let teacherAgent: Awaited<ReturnType<typeof agentFor>>;
  const userIds: string[] = [];

  before(async () => {
    const teacher = await createUser({
      name: "Result Teacher",
      email: `res-teacher-${tag}@domain.edu`,
      role: "teacher",
    });
    const student = await createUser({
      name: "Result Student",
      email: `res-student-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `RES${tag}`,
    });
    const other = await createUser({
      name: "Result Unassigned",
      email: `res-other-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `RESO${tag}`,
    });

    teacherId = teacher.id;
    studentId = student.id;
    userIds.push(teacher.id, student.id, other.id);

    studentAgent = await agentFor(student.email);
    unassignedAgent = await agentFor(other.email);
    teacherAgent = await agentFor(teacher.email);
  });

  after(async () => {
    await prisma.exam.deleteMany({ where: { createdById: teacherId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  // MCQ worth 2 points, true/false worth 3 points (max 5).
  async function makeExam(durationMin = 60) {
    const exam = await prisma.exam.create({
      data: {
        title: `Result Exam ${randomUUID().slice(0, 8)}`,
        createdById: teacherId,
        durationMin,
      },
    });
    const mcq = await prisma.question.create({
      data: {
        examId: exam.id,
        type: "mcq",
        text: "2 + 2 = ?",
        options: ["3", "4", "5"],
        correctAnswer: "4",
        order: 1,
        points: 2,
      },
    });
    const tf = await prisma.question.create({
      data: {
        examId: exam.id,
        type: "true_false",
        text: "The sky is blue.",
        correctAnswer: "true",
        order: 2,
        points: 3,
      },
    });
    await prisma.examAssignment.create({
      data: { examId: exam.id, studentId },
    });
    return { exam, mcq, tf };
  }

  async function answer(examId: string, questionId: string, value: string) {
    return studentAgent
      .put(`/exams/${examId}/attempt/answers/${questionId}`)
      .send({ value });
  }

  describe("availability", () => {
    it("returns 404 when the student has no attempt", async () => {
      const { exam } = await makeExam();
      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 404);
    });

    it("returns 409 while the attempt is still in progress", async () => {
      const { exam } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 409);
    });

    it("hides the exam from an unassigned student (404)", async () => {
      const { exam } = await makeExam();
      const res = await unassignedAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 404);
    });

    it("forbids staff from the student result endpoint (403)", async () => {
      const { exam } = await makeExam();
      const res = await teacherAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 403);
    });

    it("requires authentication (401)", async () => {
      const { exam } = await makeExam();
      const res = await request(app).get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 401);
    });
  });

  describe("processed result", () => {
    it("returns the full score breakdown after submission", async () => {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await answer(exam.id, mcq.id, "4"); // correct (2)
      await answer(exam.id, tf.id, "false"); // wrong (0)
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 200);

      const r = res.body.result;
      assert.equal(r.examId, exam.id);
      assert.ok(r.submittedAt, "expected submittedAt");
      assert.equal(r.score, 2);
      assert.equal(r.maxScore, 5);
      assert.equal(r.percentage, 40); // 2 / 5
      assert.equal(r.totalQuestions, 2);
      assert.equal(r.correctCount, 1);

      const byQ = Object.fromEntries(
        r.breakdown.map((b: { questionId: string }) => [b.questionId, b]),
      );
      assert.deepEqual(byQ[mcq.id], {
        questionId: mcq.id,
        points: 2,
        awardedPoints: 2,
        answered: true,
        value: "4",
        isCorrect: true,
        correctAnswer: "4",
      });
      assert.deepEqual(byQ[tf.id], {
        questionId: tf.id,
        points: 3,
        awardedPoints: 0,
        answered: true,
        value: "false",
        isCorrect: false,
        correctAnswer: "true",
      });
    });

    it("reports 100% when every answer is correct", async () => {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await answer(exam.id, mcq.id, "4");
      await answer(exam.id, tf.id, "true");
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.body.result.score, 5);
      assert.equal(res.body.result.percentage, 100);
      assert.equal(res.body.result.correctCount, 2);
    });

    it("reports 0% when nothing is answered", async () => {
      const { exam } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.body.result.score, 0);
      assert.equal(res.body.result.percentage, 0);
      assert.equal(res.body.result.correctCount, 0);
    });

    it("marks unanswered questions as awarded 0 / isCorrect null", async () => {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await answer(exam.id, tf.id, "true"); // only answer the true/false
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      const byQ = Object.fromEntries(
        res.body.result.breakdown.map((b: { questionId: string }) => [
          b.questionId,
          b,
        ]),
      );
      assert.deepEqual(byQ[mcq.id], {
        questionId: mcq.id,
        points: 2,
        awardedPoints: 0,
        answered: false,
        value: null,
        isCorrect: null,
        correctAnswer: "4",
      });
      assert.equal(res.body.result.score, 3);
    });

    it("includes the correct answer in the breakdown after submission", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await answer(exam.id, mcq.id, "3");
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      const mcqBreakdown = res.body.result.breakdown.find(
        (b: { questionId: string }) => b.questionId === mcq.id,
      );
      assert.equal(mcqBreakdown.correctAnswer, "4");
    });

    it("is stable across repeated reads (immutable result)", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await answer(exam.id, mcq.id, "4");
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const first = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      const second = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.deepEqual(second.body.result, first.body.result);
    });
  });

  describe("backend-enforced finalization", () => {
    it("auto-finalizes an expired attempt and returns its result", async () => {
      const { exam, mcq } = await makeExam(60);
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await answer(exam.id, mcq.id, "4"); // correct (2) before time runs out

      // Force the deadline into the past.
      await prisma.attempt.update({
        where: { userId_examId: { userId: studentId, examId: exam.id } },
        data: { startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      });

      const res = await studentAgent.get(`/exams/${exam.id}/attempt/result`);
      assert.equal(res.status, 200);
      assert.ok(res.body.result.submittedAt, "should be auto-submitted");
      assert.equal(res.body.result.score, 2);
    });
  });
});
