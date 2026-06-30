import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createWorld, prisma, type World } from "./helpers.js";

/** Coverage for the staff-only student directory used by the assign UI. */
describe("GET /students", () => {
  let world: World;

  before(async () => {
    world = await createWorld();
  });

  after(async () => {
    await world.cleanup();
    await prisma.$disconnect();
  });

  it("lets a teacher list student accounts", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get("/students");

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.students));
    const ids = res.body.students.map((s: { id: string }) => s.id);
    assert.ok(ids.includes(world.studentX.id));
    assert.ok(ids.includes(world.studentY.id));
    // Never leaks non-students.
    assert.ok(!ids.includes(world.teacherA.id));
  });

  it("lets an admin list student accounts", async () => {
    const agent = await agentFor(world.admin.email);
    const res = await agent.get("/students");
    assert.equal(res.status, 200);
  });

  it("forbids students from listing the directory", async () => {
    const agent = await agentFor(world.studentX.email);
    const res = await agent.get("/students");
    assert.equal(res.status, 403);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/students");
    assert.equal(res.status, 401);
  });

  it("includes the _count on a single exam detail", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get(`/exams/${world.examA.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.exam._count.questions, 1);
    assert.equal(res.body.exam._count.assignments, 1);
    assert.equal(res.body.exam._count.attempts, 0);
  });
});
