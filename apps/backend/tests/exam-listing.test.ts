import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { agentFor, createWorld, prisma, type World } from "./helpers.js";

/**
 * Coverage for the paginated, role-scoped exam listing and the exam `status`
 * field added for the listing UI.
 */
describe("exam listing (pagination + status)", () => {
  let world: World;
  // Total exams owned by teacherA after seeding extras (incl. examA from world).
  let teacherATotal: number;

  before(async () => {
    world = await createWorld();

    // Add enough exams to span multiple pages, alternating status.
    const extras = Array.from({ length: 14 }, (_, i) => ({
      title: `Listing Exam ${i} ${world.tag}`,
      status: i % 2 === 0 ? ("published" as const) : ("draft" as const),
      createdById: world.teacherA.id,
    }));
    await prisma.exam.createMany({ data: extras });
    teacherATotal = extras.length + 1; // + examA created by createWorld
  });

  after(async () => {
    await world.cleanup();
    await prisma.$disconnect();
  });

  it("returns the first page with pagination metadata", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get("/exams?page=1&pageSize=10");

    assert.equal(res.status, 200);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.pageSize, 10);
    assert.equal(res.body.total, teacherATotal);
    assert.equal(res.body.exams.length, 10);
  });

  it("returns the remaining items on the second page", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get("/exams?page=2&pageSize=10");

    assert.equal(res.status, 200);
    assert.equal(res.body.exams.length, teacherATotal - 10);
  });

  it("defaults to page 1 with a default page size when no query is given", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get("/exams");

    assert.equal(res.status, 200);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.pageSize, 10);
  });

  it("rejects an invalid page size (400)", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get("/exams?pageSize=0");
    assert.equal(res.status, 400);
  });

  it("includes the status field on every listed exam", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.get("/exams?pageSize=100");

    assert.equal(res.status, 200);
    for (const exam of res.body.exams) {
      assert.ok(["draft", "published"].includes(exam.status));
    }
  });

  it("scopes the list (and its total) to the requesting teacher", async () => {
    const agent = await agentFor(world.teacherB.email);
    const res = await agent.get("/exams?pageSize=100");

    assert.equal(res.status, 200);
    // teacherB owns only examB from createWorld.
    assert.equal(res.body.total, 1);
    assert.equal(res.body.exams[0].id, world.examB.id);
  });

  it("defaults a newly created exam to draft", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent.post("/exams").send({ title: `Draft default ${world.tag}` });

    assert.equal(res.status, 201);
    assert.equal(res.body.exam.status, "draft");
  });

  it("honors an explicit published status on create", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent
      .post("/exams")
      .send({ title: `Published on create ${world.tag}`, status: "published" });

    assert.equal(res.status, 201);
    assert.equal(res.body.exam.status, "published");
  });
});
