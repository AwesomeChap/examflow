import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createWorld, prisma, type World } from "./helpers.js";

describe("role-based access control", () => {
  let world: World;

  before(async () => {
    world = await createWorld();
  });

  after(async () => {
    await world.cleanup();
    await prisma.$disconnect();
  });

  describe("/admin (admin only)", () => {
    it("allows an admin", async () => {
      const agent = await agentFor(world.admin.email);
      const res = await agent.get("/admin/dashboard");
      assert.equal(res.status, 200);
      assert.ok(res.body.users);
    });

    it("forbids a teacher (403)", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.get("/admin/dashboard");
      assert.equal(res.status, 403);
    });

    it("forbids a student (403)", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get("/admin/dashboard");
      assert.equal(res.status, 403);
    });

    it("rejects unauthenticated access (401)", async () => {
      const res = await request(app).get("/admin/dashboard");
      assert.equal(res.status, 401);
    });
  });

  describe("/teacher (staff: admin + teacher)", () => {
    it("allows a teacher", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.get("/teacher/dashboard");
      assert.equal(res.status, 200);
    });

    it("allows an admin (superset of staff)", async () => {
      const agent = await agentFor(world.admin.email);
      const res = await agent.get("/teacher/dashboard");
      assert.equal(res.status, 200);
    });

    it("forbids a student (403)", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.get("/teacher/dashboard");
      assert.equal(res.status, 403);
    });
  });

  describe("exam mutations (staff only, owner-scoped)", () => {
    it("forbids a student from creating an exam (403)", async () => {
      const agent = await agentFor(world.studentX.email);
      const res = await agent.post("/exams").send({ title: "Nope" });
      assert.equal(res.status, 403);
    });

    it("lets a teacher create an exam (201)", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent.post("/exams").send({ title: "New Exam" });
      assert.equal(res.status, 201);
      assert.equal(res.body.exam.createdById, world.teacherA.id);
    });

    it("hides another teacher's exam from updates (404)", async () => {
      const agent = await agentFor(world.teacherA.email);
      const res = await agent
        .put(`/exams/${world.examB.id}`)
        .send({ title: "Hijack" });
      assert.equal(res.status, 404);
    });

    it("hides another teacher's exam from deletes (404)", async () => {
      const agent = await agentFor(world.teacherB.email);
      const res = await agent.delete(`/exams/${world.examA.id}`);
      assert.equal(res.status, 404);
    });

    it("lets an admin update any exam (200)", async () => {
      const agent = await agentFor(world.admin.email);
      const res = await agent
        .put(`/exams/${world.examB.id}`)
        .send({ title: "Admin Edit" });
      assert.equal(res.status, 200);
      assert.equal(res.body.exam.title, "Admin Edit");
    });
  });
});
