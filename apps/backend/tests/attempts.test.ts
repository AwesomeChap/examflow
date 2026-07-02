import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createUser, prisma } from "./helpers.js";

/**
 * Exam attempt flow:
 *  - a student starts an attempt (start time tracked server-side),
 *  - stores MCQ + true/false answers while the attempt is open,
 *  - submits to be graded,
 *  - and is blocked by the backend-enforced time limit (auto-submit) once the
 *    deadline passes.
 */
describe("exam attempt flow", () => {
  const tag = randomUUID().slice(0, 8);
  let teacherId: string;
  let studentAgent: Awaited<ReturnType<typeof agentFor>>;
  let unassignedAgent: Awaited<ReturnType<typeof agentFor>>;
  let teacherAgent: Awaited<ReturnType<typeof agentFor>>;
  const userIds: string[] = [];
  let studentId: string;

  before(async () => {
    const teacher = await createUser({
      name: "Attempt Teacher",
      email: `att-teacher-${tag}@domain.edu`,
      role: "teacher",
    });
    const student = await createUser({
      name: "Attempt Student",
      email: `att-student-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `ATT${tag}`,
    });
    const other = await createUser({
      name: "Unassigned Student",
      email: `att-other-${tag}@domain.edu`,
      role: "student",
      matriculationNumber: `OTH${tag}`,
    });

    teacherId = teacher.id;
    studentId = student.id;
    userIds.push(teacher.id, student.id, other.id);

    studentAgent = await agentFor(student.email);
    unassignedAgent = await agentFor(other.email);
    teacherAgent = await agentFor(teacher.email);
  });

  after(async () => {
    // Deleting the teacher's exams cascades to questions/attempts/answers.
    await prisma.exam.deleteMany({ where: { createdById: teacherId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  // Creates a fresh exam (2 questions: MCQ worth 2pts, true/false worth 3pts)
  // assigned to the main student, so each test runs against its own attempt.
  async function makeExam(durationMin = 60) {
    const exam = await prisma.exam.create({
      data: {
        title: `Attempt Exam ${randomUUID().slice(0, 8)}`,
        createdById: teacherId,
        durationMin,
        status: "published",
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

  async function expireAttempt(examId: string) {
    // Push the active attempt's startedAt far enough back that any reasonable
    // duration has elapsed. (No unique (userId, examId) anymore — multiple
    // attempts are allowed — so target the in-progress one.)
    const active = await prisma.attempt.findFirst({
      where: { userId: studentId, examId, submittedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!active) throw new Error("no active attempt to expire");
    await prisma.attempt.update({
      where: { id: active.id },
      data: { startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
  }

  describe("starting an attempt", () => {
    it("starts an attempt and tracks the start time + deadline", async () => {
      const { exam } = await makeExam(60);
      const res = await studentAgent.post(`/exams/${exam.id}/attempt`);

      assert.equal(res.status, 201);
      const a = res.body.attempt;
      assert.equal(a.examId, exam.id);
      assert.ok(a.startedAt, "expected startedAt");
      assert.equal(a.submittedAt, null);
      assert.equal(a.score, null);

      const span = new Date(a.deadline).getTime() - new Date(a.startedAt).getTime();
      assert.equal(span, 60 * 60_000, "deadline should be startedAt + durationMin");
      assert.ok(a.remainingMs > 0 && a.remainingMs <= 60 * 60_000);
    });

    it("is idempotent: re-starting returns the same in-progress attempt", async () => {
      const { exam } = await makeExam();
      const first = await studentAgent.post(`/exams/${exam.id}/attempt`);
      const second = await studentAgent.post(`/exams/${exam.id}/attempt`);

      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.body.attempt.id, first.body.attempt.id);
    });

    it("hides the exam from an unassigned student (404)", async () => {
      const { exam } = await makeExam();
      const res = await unassignedAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 404);
    });

    it("forbids staff from starting an attempt (403)", async () => {
      const { exam } = await makeExam();
      const res = await teacherAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 403);
    });

    it("requires authentication (401)", async () => {
      const { exam } = await makeExam();
      const res = await request(app).post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 401);
    });
  });

  describe("storing answers", () => {
    it("stores MCQ and true/false answers during the attempt", async () => {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      const mcqRes = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" });
      assert.equal(mcqRes.status, 200);
      assert.equal(mcqRes.body.answer.value, "4");

      const tfRes = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${tf.id}`)
        .send({ value: "true" });
      assert.equal(tfRes.status, 200);
      assert.equal(tfRes.body.answer.value, "true");
    });

    it("overwrites a previously stored answer", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "3" });
      const updated = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" });

      assert.equal(updated.status, 200);
      assert.equal(updated.body.answer.value, "4");
    });

    it("rejects an MCQ value that is not one of the options (400)", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      const res = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "42" });
      assert.equal(res.status, 400);
    });

    it("rejects a true/false value that is not true/false (400)", async () => {
      const { exam, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      const res = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${tf.id}`)
        .send({ value: "maybe" });
      assert.equal(res.status, 400);
    });

    it("returns 404 for a question not on the exam", async () => {
      const { exam } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);

      const res = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/does-not-exist`)
        .send({ value: "4" });
      assert.equal(res.status, 404);
    });

    it("returns 404 when answering without an active attempt", async () => {
      const { exam, mcq } = await makeExam();
      const res = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" });
      assert.equal(res.status, 404);
    });

    it("withholds per-answer correctness while in progress", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" });

      const res = await studentAgent.get(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 200);
      assert.equal(res.body.attempt.submittedAt, null);
      for (const ans of res.body.attempt.answers) {
        assert.ok(!("isCorrect" in ans), "must not reveal correctness mid-attempt");
      }
    });
  });

  describe("submitting", () => {
    it("grades the attempt and reveals correctness on submit", async () => {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" }); // correct (2 pts)
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${tf.id}`)
        .send({ value: "false" }); // wrong (0 pts)

      const res = await studentAgent.post(`/exams/${exam.id}/attempt/submit`);
      assert.equal(res.status, 200);
      assert.equal(res.body.attempt.score, 2, "only the MCQ should score");
      assert.ok(res.body.attempt.submittedAt, "expected submittedAt");
      assert.equal(res.body.attempt.remainingMs, 0);

      const correctness = Object.fromEntries(
        res.body.attempt.answers.map(
          (a: { questionId: string; isCorrect: boolean }) => [
            a.questionId,
            a.isCorrect,
          ],
        ),
      );
      assert.equal(correctness[mcq.id], true);
      assert.equal(correctness[tf.id], false);
    });

    it("blocks answering after submission (no active attempt, 404)", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      // Once submitted there is no active attempt to answer against.
      const res = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" });
      assert.equal(res.status, 404);
    });

    it("is idempotent: re-submitting returns the graded result", async () => {
      const { exam, mcq } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" });

      const first = await studentAgent.post(`/exams/${exam.id}/attempt/submit`);
      const second = await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(second.body.attempt.score, first.body.attempt.score);
      assert.equal(second.body.attempt.id, first.body.attempt.id);
    });
  });

  describe("backend-enforced time limit (auto-submit)", () => {
    it("rejects answers once the deadline has passed and auto-submits", async () => {
      const { exam, mcq } = await makeExam(60);
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" }); // correct, stored before time runs out

      await expireAttempt(exam.id);

      const blocked = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "3" });
      assert.equal(blocked.status, 409);

      // The attempt is now finalized; the late edit never took effect.
      const list = await studentAgent.get(`/exams/${exam.id}/attempts`);
      assert.equal(list.status, 200);
      const [state] = list.body.attempts;
      assert.ok(state.submittedAt, "should be auto-submitted");
      assert.equal(state.score, 2, "graded on answers before the limit");
    });

    it("auto-finalizes on read after expiry", async () => {
      const { exam } = await makeExam(60);
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await expireAttempt(exam.id);

      const res = await studentAgent.get(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 200);
      assert.ok(res.body.attempt.submittedAt, "read should trigger auto-submit");
      assert.equal(res.body.attempt.remainingMs, 0);
    });

    it("refuses to re-start an expired attempt (409)", async () => {
      const { exam } = await makeExam(60);
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await expireAttempt(exam.id);

      const res = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 409);
    });
  });

  describe("score calculation correctness", () => {
    // Helper: start, answer the two questions, submit, return the score.
    async function scoreFor(answers: { mcq?: string; tf?: string }) {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      if (answers.mcq !== undefined) {
        await studentAgent
          .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
          .send({ value: answers.mcq });
      }
      if (answers.tf !== undefined) {
        await studentAgent
          .put(`/exams/${exam.id}/attempt/answers/${tf.id}`)
          .send({ value: answers.tf });
      }
      const res = await studentAgent.post(`/exams/${exam.id}/attempt/submit`);
      assert.equal(res.status, 200);
      return res.body.attempt.score as number;
    }

    // MCQ is worth 2 points, true/false is worth 3 points (total 5).
    it("awards full marks when every answer is correct", async () => {
      assert.equal(await scoreFor({ mcq: "4", tf: "true" }), 5);
    });

    it("awards zero when all answers are wrong", async () => {
      assert.equal(await scoreFor({ mcq: "3", tf: "false" }), 0);
    });

    it("sums only the points of the correctly answered questions", async () => {
      // MCQ correct (2), true/false wrong (0).
      assert.equal(await scoreFor({ mcq: "4", tf: "false" }), 2);
      // MCQ wrong (0), true/false correct (3).
      assert.equal(await scoreFor({ mcq: "3", tf: "true" }), 3);
    });

    it("ignores unanswered questions", async () => {
      // Only the true/false answered correctly -> 3 of a possible 5.
      assert.equal(await scoreFor({ tf: "true" }), 3);
    });

    it("scores zero when nothing is answered", async () => {
      assert.equal(await scoreFor({}), 0);
    });
  });

  describe("attempt cannot be modified after submission", () => {
    it("rejects late answers and leaves the stored answer + score intact", async () => {
      const { exam, mcq, tf } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${mcq.id}`)
        .send({ value: "4" }); // correct (2 pts)
      await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${tf.id}`)
        .send({ value: "false" }); // wrong (0 pts)

      const submitted = await studentAgent.post(
        `/exams/${exam.id}/attempt/submit`,
      );
      assert.equal(submitted.body.attempt.score, 2);
      const attemptId = submitted.body.attempt.id;

      // Try to "fix" the wrong answer after submitting: there is no active
      // attempt to write to.
      const late = await studentAgent
        .put(`/exams/${exam.id}/attempt/answers/${tf.id}`)
        .send({ value: "true" });
      assert.equal(late.status, 404);

      // State is unchanged: same score, and the stored value was not updated.
      const result = await studentAgent.get(
        `/exams/${exam.id}/attempts/${attemptId}/result`,
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.result.score, 2, "score must not change");
      const tfItem = result.body.result.breakdown.find(
        (b: { questionId: string }) => b.questionId === tf.id,
      );
      assert.equal(tfItem.value, "false", "stored answer must not change");
    });

    it("rejects re-starting a submitted attempt (409)", async () => {
      const { exam } = await makeExam();
      await studentAgent.post(`/exams/${exam.id}/attempt`);
      await studentAgent.post(`/exams/${exam.id}/attempt/submit`);

      const res = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(res.status, 409);
    });
  });

  describe("multiple / unlimited attempts", () => {
    // Exam with a configurable attempt limit assigned to the main student.
    async function makeExamWithAttempts(maxAttempts: number | null) {
      const exam = await prisma.exam.create({
        data: {
          title: `Retake Exam ${randomUUID().slice(0, 8)}`,
          createdById: teacherId,
          durationMin: 60,
          maxAttempts,
          status: "published",
        },
      });
      const mcq = await prisma.question.create({
        data: {
          examId: exam.id,
          type: "mcq",
          text: "2 + 2 = ?",
          options: ["3", "4"],
          correctAnswer: "4",
          order: 1,
          points: 2,
        },
      });
      await prisma.examAssignment.create({ data: { examId: exam.id, studentId } });
      return { exam, mcq };
    }

    async function takeOnce(examId: string, mcqId: string, value: string) {
      await studentAgent.post(`/exams/${examId}/attempt`);
      await studentAgent
        .put(`/exams/${examId}/attempt/answers/${mcqId}`)
        .send({ value });
      return studentAgent.post(`/exams/${examId}/attempt/submit`);
    }

    it("allows a retake within the attempt limit", async () => {
      const { exam, mcq } = await makeExamWithAttempts(2);

      const first = await takeOnce(exam.id, mcq.id, "3"); // wrong -> 0
      assert.equal(first.status, 200);
      assert.equal(first.body.attempt.score, 0);

      const retake = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(retake.status, 201, "a second attempt is allowed");
      assert.notEqual(retake.body.attempt.id, first.body.attempt.id);
    });

    it("blocks a retake once the limit is reached (409)", async () => {
      const { exam, mcq } = await makeExamWithAttempts(2);

      await takeOnce(exam.id, mcq.id, "3");
      await takeOnce(exam.id, mcq.id, "4");

      const third = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(third.status, 409, "third start is blocked");
    });

    it("allows unlimited retakes when maxAttempts is null", async () => {
      const { exam, mcq } = await makeExamWithAttempts(null);

      for (let i = 0; i < 3; i += 1) {
        const res = await takeOnce(exam.id, mcq.id, i === 2 ? "4" : "3");
        assert.equal(res.status, 200);
      }

      const again = await studentAgent.post(`/exams/${exam.id}/attempt`);
      assert.equal(again.status, 201, "still allowed after several attempts");
    });

    it("resumes the active attempt rather than creating a parallel one", async () => {
      const { exam } = await makeExamWithAttempts(3);
      const first = await studentAgent.post(`/exams/${exam.id}/attempt`);
      const second = await studentAgent.post(`/exams/${exam.id}/attempt`);

      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.body.attempt.id, first.body.attempt.id);
    });

    it("lists the student's attempts with numbers and scores", async () => {
      const { exam, mcq } = await makeExamWithAttempts(3);
      await takeOnce(exam.id, mcq.id, "3"); // 0
      await takeOnce(exam.id, mcq.id, "4"); // 2

      const list = await studentAgent.get(`/exams/${exam.id}/attempts`);
      assert.equal(list.status, 200);
      assert.equal(list.body.attempts.length, 2);
      assert.equal(list.body.attempts[0].attemptNumber, 1);
      assert.equal(list.body.attempts[0].score, 0);
      assert.equal(list.body.attempts[1].attemptNumber, 2);
      assert.equal(list.body.attempts[1].score, 2);
      assert.equal(list.body.attempts[1].maxScore, 2);
    });

    it("returns a per-attempt result and hides other students' attempts", async () => {
      const { exam, mcq } = await makeExamWithAttempts(2);
      const submitted = await takeOnce(exam.id, mcq.id, "4");
      const attemptId = submitted.body.attempt.id;

      const owned = await studentAgent.get(
        `/exams/${exam.id}/attempts/${attemptId}/result`,
      );
      assert.equal(owned.status, 200);
      assert.equal(owned.body.result.score, 2);

      // A student who is not assigned cannot read the exam at all (404).
      const other = await unassignedAgent.get(
        `/exams/${exam.id}/attempts/${attemptId}/result`,
      );
      assert.equal(other.status, 404);
    });
  });
});
