import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createWorld, prisma, type World } from "./helpers.js";

/**
 * Focused coverage for the exam access APIs (`GET /exams`,
 * `GET /exams/:examId`, and the nested `GET /exams/:examId/questions`).
 *
 * The four scenarios below are the security contract for student exam access:
 *  - students only reach exams they are assigned to,
 *  - teachers are isolated to exams they own,
 *  - admins can reach everything,
 *  - and every denied / malformed request returns a proper error code
 *    (401 for no session, 404 for hidden-or-missing, never 403 that would
 *    leak the existence of an exam to an unauthorized reader).
 */
describe("exam access APIs", () => {
  let world: World;
  // The single MCQ question seeded on examA (used for nested-route checks).
  let examAQuestionId: string;

  before(async () => {
    world = await createWorld();
    const question = await prisma.question.findFirstOrThrow({
      where: { examId: world.examA.id },
      select: { id: true },
    });
    examAQuestionId = question.id;
  });

  after(async () => {
    await world.cleanup();
    await prisma.$disconnect();
  });

  describe("student can only access assigned exams", () => {
    it("lists only the exams the student is assigned to", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get("/exams");

      assert.equal(res.status, 200);
      const ids = (res.body.exams as { id: string }[]).map((e) => e.id);
      assert.ok(ids.includes(world.examA.id), "studentX should see examA");
      assert.ok(!ids.includes(world.examB.id), "studentX must not see examB");
    });

    it("returns an empty list for a student with no assignments", async () => {
      const agent = await agentFor(world.studentY.email);
      const res = await agent.get("/exams");

      assert.equal(res.status, 200);
      const ids = (res.body.exams as { id: string }[]).map((e) => e.id);
      assert.ok(!ids.includes(world.examA.id));
      assert.ok(!ids.includes(world.examB.id));
    });

    it("reads an assigned exam with its questions but no correct answers", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get(`/exams/${world.examA.id}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.exam.id, world.examA.id);
      assert.ok(res.body.exam.questions.length > 0, "expected questions");
      for (const q of res.body.exam.questions) {
        assert.ok(
          !("correctAnswer" in q),
          "students must never receive correctAnswer",
        );
      }
    });

    it("reads assigned-exam questions via the nested route without answers", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get(`/exams/${world.examA.id}/questions`);

      assert.equal(res.status, 200);
      assert.ok(res.body.questions.length > 0);
      for (const q of res.body.questions) {
        assert.ok(!("correctAnswer" in q));
      }
    });

    it("hides an unassigned exam from the student (404)", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get(`/exams/${world.examB.id}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Exam not found");
    });

    it("hides an unassigned exam's questions from the student (404)", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get(`/exams/${world.examB.id}/questions`);

      assert.equal(res.status, 404);
    });
  });

  describe("teacher cannot access other teacher's exams", () => {
    it("excludes other teachers' exams from the list", async () => {
      const agent = await agentFor(world.teacherB.email);
      const res = await agent.get("/exams");

      assert.equal(res.status, 200);
      const ids = (res.body.exams as { id: string }[]).map((e) => e.id);
      assert.ok(ids.includes(world.examB.id), "teacherB should see own examB");
      assert.ok(!ids.includes(world.examA.id), "teacherB must not see examA");
    });

    it("returns 404 when reading another teacher's exam", async () => {
      const agent = await agentFor(world.teacherB.email);
      const res = await agent.get(`/exams/${world.examA.id}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Exam not found");
    });

    it("returns 404 when reading another teacher's exam questions", async () => {
      const agent = await agentFor(world.teacherB.email);
      const res = await agent.get(`/exams/${world.examA.id}/questions`);

      assert.equal(res.status, 404);
    });

    it("lets the owning teacher read their exam with correct answers", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.get(`/exams/${world.examA.id}`);

      assert.equal(res.status, 200);
      assert.ok(
        res.body.exam.questions.every((q: { correctAnswer?: string }) =>
          Boolean(q.correctAnswer),
        ),
        "owning teacher should see correctAnswer",
      );
    });
  });

  describe("admin can access all exams", () => {
    it("lists every exam regardless of owner or assignment", async () => {
      const agent = await agentFor(world.admin.email);
      // Use a large page so the assertion tests visibility, not pagination:
      // the suite's other files create many exams concurrently in the shared DB.
      const res = await agent.get("/exams?pageSize=100");

      assert.equal(res.status, 200);
      const ids = (res.body.exams as { id: string }[]).map((e) => e.id);
      assert.ok(ids.includes(world.examA.id), "admin should see examA");
      assert.ok(ids.includes(world.examB.id), "admin should see examB");
    });

    it("reads any exam with questions including correct answers", async () => {
      const agent = await agentFor(world.admin.email);
      const res = await agent.get(`/exams/${world.examA.id}`);

      assert.equal(res.status, 200);
      assert.ok(
        res.body.exam.questions.every((q: { correctAnswer?: string }) =>
          Boolean(q.correctAnswer),
        ),
        "admin should see correctAnswer",
      );
    });

    it("reads an exam owned by a different teacher", async () => {
      const agent = await agentFor(world.admin.email);
      const res = await agent.get(`/exams/${world.examB.id}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.exam.id, world.examB.id);
    });
  });

  describe("invalid access returns proper errors", () => {
    it("rejects unauthenticated exam listing (401)", async () => {
      const res = await request(app).get("/exams");
      assert.equal(res.status, 401);
    });

    it("rejects unauthenticated single-exam reads (401)", async () => {
      const res = await request(app).get(`/exams/${world.examA.id}`);
      assert.equal(res.status, 401);
    });

    it("rejects unauthenticated nested question reads (401)", async () => {
      const res = await request(app).get(`/exams/${world.examA.id}/questions`);
      assert.equal(res.status, 401);
    });

    it("returns 404 for a non-existent exam even for an admin", async () => {
      const agent = await agentFor(world.admin.email);
      const res = await agent.get("/exams/does-not-exist");

      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Exam not found");
    });

    it("returns the same 404 for missing and unauthorized exams (no leak)", async () => {
      const agent = await agentFor(world.studentX.email);
      const missing = await agent.get("/exams/does-not-exist");
      const forbidden = await agent.get(`/exams/${world.examB.id}`);

      assert.equal(missing.status, 404);
      assert.equal(forbidden.status, 404);
      assert.deepEqual(missing.body, forbidden.body);
    });

    it("returns 404 for a non-existent question on an accessible exam", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.get(
        `/exams/${world.examA.id}/questions/does-not-exist`,
      );

      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Question not found");
    });

    it("allows reading a real question on an accessible exam", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.get(
        `/exams/${world.examA.id}/questions/${examAQuestionId}`,
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.question.id, examAQuestionId);
    });
  });
});
