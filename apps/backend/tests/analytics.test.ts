import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createUser, prisma } from "./helpers.js";

/**
 * Per-exam teacher analytics (`GET /exams/:examId/analytics`): attempt summary,
 * average score, percentage-band distribution, and per-question correctness.
 *
 * The fixture below produces fully deterministic numbers. The exam has an MCQ
 * worth 2 points (correct = "4") and a true/false worth 3 points
 * (correct = "true"); max score = 5. Four students are assigned:
 *  - full       -> 4 / true   -> 5  (100%)
 *  - partial    -> 4 / false  -> 2  (40%)
 *  - zero       -> 3 / (none) -> 0  (0%)
 *  - inProgress -> starts but never submits (excluded from score stats)
 */
describe("per-exam analytics", () => {
  const tag = randomUUID().slice(0, 8);
  let examId: string;
  let mcqId: string;
  let tfId: string;
  let ownerAgent: Awaited<ReturnType<typeof agentFor>>;
  let adminAgent: Awaited<ReturnType<typeof agentFor>>;
  let otherTeacherAgent: Awaited<ReturnType<typeof agentFor>>;
  let studentAgent: Awaited<ReturnType<typeof agentFor>>;
  const userIds: string[] = [];

  async function runAttempt(
    email: string,
    answers: { mcq?: string; tf?: string },
    submit: boolean,
  ) {
    const agent = await agentFor(email);
    await agent.post(`/exams/${examId}/attempt`);
    if (answers.mcq !== undefined) {
      await agent
        .put(`/exams/${examId}/attempt/answers/${mcqId}`)
        .send({ value: answers.mcq });
    }
    if (answers.tf !== undefined) {
      await agent
        .put(`/exams/${examId}/attempt/answers/${tfId}`)
        .send({ value: answers.tf });
    }
    if (submit) await agent.post(`/exams/${examId}/attempt/submit`);
  }

  before(async () => {
    const owner = await createUser({
      name: "Owner Teacher",
      email: `an-owner-${tag}@domain.edu`,
      role: "teacher",
    });
    const otherTeacher = await createUser({
      name: "Other Teacher",
      email: `an-other-${tag}@domain.edu`,
      role: "teacher",
    });
    const admin = await createUser({
      name: "An Admin",
      email: `an-admin-${tag}@domain.edu`,
      role: "admin",
    });

    const students = await Promise.all(
      ["full", "partial", "zero", "inprog"].map((k, i) =>
        createUser({
          name: `Student ${k}`,
          email: `an-${k}-${tag}@domain.edu`,
          role: "student",
          matriculationNumber: `AN${i}${tag}`,
        }),
      ),
    );

    userIds.push(
      owner.id,
      otherTeacher.id,
      admin.id,
      ...students.map((s) => s.id),
    );

    const exam = await prisma.exam.create({
      data: {
        title: `Analytics Exam ${tag}`,
        createdById: owner.id,
        durationMin: 60,
      },
    });
    examId = exam.id;

    const mcq = await prisma.question.create({
      data: {
        examId,
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
        examId,
        type: "true_false",
        text: "The sky is blue.",
        correctAnswer: "true",
        order: 2,
        points: 3,
      },
    });
    mcqId = mcq.id;
    tfId = tf.id;

    await prisma.examAssignment.createMany({
      data: students.map((s) => ({ examId, studentId: s.id })),
    });

    ownerAgent = await agentFor(owner.email);
    adminAgent = await agentFor(admin.email);
    otherTeacherAgent = await agentFor(otherTeacher.email);
    studentAgent = await agentFor(students[0].email);

    await runAttempt(students[0].email, { mcq: "4", tf: "true" }, true);
    await runAttempt(students[1].email, { mcq: "4", tf: "false" }, true);
    await runAttempt(students[2].email, { mcq: "3" }, true);
    await runAttempt(students[3].email, {}, false);
  });

  after(async () => {
    await prisma.exam.deleteMany({ where: { id: examId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe("access control", () => {
    it("allows the owning teacher", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      assert.equal(res.status, 200);
    });

    it("allows an admin", async () => {
      const res = await adminAgent.get(`/exams/${examId}/analytics`);
      assert.equal(res.status, 200);
    });

    it("hides the exam from a non-owning teacher (404)", async () => {
      const res = await otherTeacherAgent.get(`/exams/${examId}/analytics`);
      assert.equal(res.status, 404);
    });

    it("forbids students (403)", async () => {
      const res = await studentAgent.get(`/exams/${examId}/analytics`);
      assert.equal(res.status, 403);
    });

    it("requires authentication (401)", async () => {
      const res = await request(app).get(`/exams/${examId}/analytics`);
      assert.equal(res.status, 401);
    });
  });

  describe("attempt summary", () => {
    it("counts total, submitted, in-progress and completion rate", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      const a = res.body.analytics.attempts;

      assert.equal(a.total, 4);
      assert.equal(a.submitted, 3);
      assert.equal(a.inProgress, 1);
      assert.equal(a.assignedStudents, 4);
      assert.equal(a.completionRate, 75); // 3 / 4
    });
  });

  describe("average score", () => {
    it("averages only submitted attempts", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      const s = res.body.analytics.score;

      assert.equal(res.body.analytics.exam.maxScore, 5);
      assert.equal(s.averageScore, 2.33); // (5 + 2 + 0) / 3
      assert.equal(s.averagePercentage, 46.67); // 2.333 / 5
      assert.equal(s.highestScore, 5);
      assert.equal(s.lowestScore, 0);
    });

    it("reports median and standard deviation for the distribution curve", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      const s = res.body.analytics.score;

      assert.equal(s.medianScore, 2); // sorted [0, 2, 5]
      assert.equal(s.stdDev, 2.05); // population std dev of [5, 2, 0]
    });
  });

  describe("completion time", () => {
    it("reports non-negative average and median durations", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      const t = res.body.analytics.timing;

      assert.equal(typeof t.averageDurationMs, "number");
      assert.ok(t.averageDurationMs >= 0);
      assert.equal(typeof t.medianDurationMs, "number");
      assert.ok(t.medianDurationMs >= 0);
    });
  });

  describe("score distribution", () => {
    it("buckets submitted scores into percentage bands", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      const byLabel = Object.fromEntries(
        res.body.analytics.score.distribution.map(
          (b: { label: string; count: number }) => [b.label, b.count],
        ),
      );

      assert.equal(byLabel["0-20"], 1); // the 0% attempt
      assert.equal(byLabel["20-40"], 0);
      assert.equal(byLabel["40-60"], 1); // the 40% attempt
      assert.equal(byLabel["60-80"], 0);
      assert.equal(byLabel["80-100"], 1); // the 100% attempt
    });
  });

  describe("per-question correctness", () => {
    it("computes correct counts and rates over submitted attempts", async () => {
      const res = await ownerAgent.get(`/exams/${examId}/analytics`);
      const byQ = Object.fromEntries(
        res.body.analytics.questions.map((q: { questionId: string }) => [
          q.questionId,
          q,
        ]),
      );

      // MCQ: full + partial correct, zero wrong -> 2/3 correct.
      assert.equal(byQ[mcqId].answered, 3);
      assert.equal(byQ[mcqId].correct, 2);
      assert.equal(byQ[mcqId].correctRate, 66.67);

      // True/false: only full correct; zero left it unanswered -> 1/3 correct.
      assert.equal(byQ[tfId].answered, 2);
      assert.equal(byQ[tfId].correct, 1);
      assert.equal(byQ[tfId].correctRate, 33.33);
    });
  });

  describe("exam with no attempts", () => {
    it("returns zeroed stats and empty distribution counts", async () => {
      const emptyExam = await prisma.exam.create({
        data: {
          title: `Empty Analytics ${randomUUID().slice(0, 8)}`,
          createdById: userIds[0],
          durationMin: 30,
        },
      });

      const res = await ownerAgent.get(`/exams/${emptyExam.id}/analytics`);
      assert.equal(res.status, 200);
      const an = res.body.analytics;
      assert.equal(an.attempts.total, 0);
      assert.equal(an.attempts.completionRate, 0);
      assert.equal(an.score.averageScore, 0);
      assert.equal(an.score.highestScore, null);
      assert.equal(an.score.lowestScore, null);
      assert.equal(an.score.medianScore, null);
      assert.equal(an.score.stdDev, 0);
      assert.equal(an.timing.averageDurationMs, null);
      assert.equal(an.timing.medianDurationMs, null);
      for (const band of an.score.distribution) {
        assert.equal(band.count, 0);
      }

      await prisma.exam.delete({ where: { id: emptyExam.id } });
    });
  });
});
