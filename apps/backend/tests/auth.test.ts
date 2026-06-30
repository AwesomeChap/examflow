import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createUser, prisma, TEST_PASSWORD } from "./helpers.js";

describe("authentication", () => {
  const tag = randomUUID().slice(0, 8);
  const teacherEmail = `auth-teacher-${tag}@domain.edu`;
  const studentEmail = `auth-student-${tag}@domain.edu`;
  const studentMat = `AUTH${tag}`;
  const noPasswordEmail = `auth-nopass-${tag}@domain.edu`;

  const userIds: string[] = [];

  before(async () => {
    const teacher = await createUser({
      name: "Auth Teacher",
      email: teacherEmail,
      role: "teacher",
    });
    const student = await createUser({
      name: "Auth Student",
      email: studentEmail,
      role: "student",
      matriculationNumber: studentMat,
    });
    const noPass = await createUser({
      name: "No Password Student",
      email: noPasswordEmail,
      role: "student",
      matriculationNumber: `NOPASS${tag}`,
      password: null,
    });
    userIds.push(teacher.id, student.id, noPass.id);
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("logs in staff by email and sets an HttpOnly cookie", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ identifier: teacherEmail, password: TEST_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "teacher");

    const setCookie = res.headers["set-cookie"];
    assert.ok(setCookie, "expected a Set-Cookie header");
    const cookie = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
    assert.match(cookie, /examflow_token=/);
    assert.match(cookie, /HttpOnly/i);
  });

  it("logs in a student by email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ identifier: studentEmail, password: TEST_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "student");
    assert.equal(res.body.user.matriculationNumber, studentMat);
  });

  it("logs in a student by matriculation number (case-insensitive)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ identifier: studentMat.toLowerCase(), password: TEST_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, studentEmail);
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ identifier: teacherEmail, password: "wrong" });

    assert.equal(res.status, 401);
  });

  it("rejects an unknown identifier with 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ identifier: `nobody-${tag}@domain.edu`, password: "x" });

    assert.equal(res.status, 401);
  });

  it("rejects an account that has no password set with 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ identifier: noPasswordEmail, password: TEST_PASSWORD });

    assert.equal(res.status, 401);
  });

  it("returns 400 when the identifier is missing", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ password: TEST_PASSWORD });

    assert.equal(res.status, 400);
  });

  it("rejects /me without a session cookie", async () => {
    const res = await request(app).get("/me");
    assert.equal(res.status, 401);
  });

  it("returns the current user on /me when authenticated", async () => {
    const agent = await agentFor(studentEmail);
    const res = await agent.get("/me");

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, studentEmail);
    assert.equal(res.body.user.role, "student");
    assert.ok(res.body.user.createdAt, "expected createdAt in profile");
  });

  it("clears the session on logout", async () => {
    const agent = await agentFor(teacherEmail);

    const before = await agent.get("/me");
    assert.equal(before.status, 200);

    const logout = await agent.post("/auth/logout");
    assert.equal(logout.status, 200);

    const after = await agent.get("/me");
    assert.equal(after.status, 401);
  });
});
