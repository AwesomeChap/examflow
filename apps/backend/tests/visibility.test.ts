import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { agentFor, createWorld, prisma, type World } from "./helpers.js";

async function listedExamIds(agent: Awaited<ReturnType<typeof agentFor>>) {
  const res = await agent.get("/exams");
  assert.equal(res.status, 200);
  return (res.body.exams as { id: string }[]).map((e) => e.id);
}

describe("exam visibility rules", () => {
  let world: World;

  before(async () => {
    world = await createWorld();
  });

  after(async () => {
    await world.cleanup();
    await prisma.$disconnect();
  });

  it("admin sees all exams", async () => {
    const agent = await agentFor(world.admin.email);
    const ids = await listedExamIds(agent);
    assert.ok(ids.includes(world.examA.id), "admin should see examA");
    assert.ok(ids.includes(world.examB.id), "admin should see examB");
  });

  it("teacher sees only their own exams", async () => {
    const agentA = await agentFor(world.teacherA.email);
    const idsA = await listedExamIds(agentA);
    assert.ok(idsA.includes(world.examA.id), "teacherA should see examA");
    assert.ok(!idsA.includes(world.examB.id), "teacherA must not see examB");

    const agentB = await agentFor(world.teacherB.email);
    const idsB = await listedExamIds(agentB);
    assert.ok(idsB.includes(world.examB.id), "teacherB should see examB");
    assert.ok(!idsB.includes(world.examA.id), "teacherB must not see examA");
  });

  it("student sees only assigned exams", async () => {
    const agentX = await agentFor(world.studentX.email);
    const idsX = await listedExamIds(agentX);
    assert.ok(idsX.includes(world.examA.id), "studentX should see assigned examA");
    assert.ok(!idsX.includes(world.examB.id), "studentX must not see examB");

    const agentY = await agentFor(world.studentY.email);
    const idsY = await listedExamIds(agentY);
    assert.ok(!idsY.includes(world.examA.id), "studentY must not see examA");
    assert.ok(!idsY.includes(world.examB.id), "studentY must not see examB");
  });

  describe("single-exam access", () => {
    it("lets an assigned student read the exam without correct answers", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get(`/exams/${world.examA.id}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.exam.questions.length > 0, "expected questions");
      for (const q of res.body.exam.questions) {
        assert.ok(
          !("correctAnswer" in q),
          "students must not receive correctAnswer",
        );
      }
    });

    it("includes correct answers for the owning teacher", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.get(`/exams/${world.examA.id}`);

      assert.equal(res.status, 200);
      assert.ok(
        res.body.exam.questions.every((q: { correctAnswer?: string }) =>
          Boolean(q.correctAnswer),
        ),
        "teacher should see correctAnswer",
      );
    });

    it("hides an unassigned exam from a student (404)", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get(`/exams/${world.examB.id}`);
      assert.equal(res.status, 404);
    });

    it("hides another teacher's exam (404)", async () => {
      const agent = await agentFor(world.teacherB.email);
      const res = await agent.get(`/exams/${world.examA.id}`);
      assert.equal(res.status, 404);
    });
  });
});
