import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { agentFor, app, createUser, prisma, TEST_PASSWORD } from "./helpers.js";

/**
 * Coverage for the admin user-management API: creation with auto-generated
 * identifiers, role filtering + pagination, soft-delete (deactivate/reactivate),
 * and the login/`/me` blocks that enforce deactivation.
 */
describe("admin user management APIs", () => {
  const tag = randomUUID().slice(0, 8);
  // A stable, DB-unique first-name token so generated emails are predictable.
  const uniqueFirst = `zq${tag}`;
  const createdUserIds: string[] = [];
  let adminAgent: Awaited<ReturnType<typeof agentFor>>;
  let teacherAgent: Awaited<ReturnType<typeof agentFor>>;
  let adminId: string;

  before(async () => {
    const admin = await createUser({
      name: "Panel Admin",
      email: `padmin-${tag}@examflow.edu`,
      role: "admin",
    });
    const teacher = await createUser({
      name: "Panel Teacher",
      email: `pteacher-${tag}@examflow.edu`,
      role: "teacher",
    });
    adminId = admin.id;
    createdUserIds.push(admin.id, teacher.id);

    adminAgent = await agentFor(admin.email);
    teacherAgent = await agentFor(teacher.email);
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  // Helper: create a user via the API and register it for cleanup.
  async function apiCreate(body: {
    name: string;
    role: "teacher" | "student";
    password?: string;
  }) {
    const res = await adminAgent.post("/admin/users").send({
      password: TEST_PASSWORD,
      ...body,
    });
    if (res.status === 201) createdUserIds.push(res.body.user.id);
    return res;
  }

  it("rejects non-admin callers with 403", async () => {
    const list = await teacherAgent.get("/admin/users");
    assert.equal(list.status, 403);

    const create = await teacherAgent
      .post("/admin/users")
      .send({ name: "Nope", role: "student", password: TEST_PASSWORD });
    assert.equal(create.status, 403);
  });

  it("creates a teacher with a generated staff email and no matriculation", async () => {
    const res = await apiCreate({ name: `${uniqueFirst} Teacher`, role: "teacher" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "teacher");
    assert.equal(res.body.user.email, `${uniqueFirst}@examflow.edu`);
    assert.equal(res.body.user.matriculationNumber, null);
    assert.equal(res.body.user.deactivatedAt, null);
  });

  it("creates a student with a generated student email + matriculation", async () => {
    const res = await apiCreate({ name: `${uniqueFirst} Student`, role: "student" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "student");
    // Different domain from the teacher, so no collision and no suffix.
    assert.equal(res.body.user.email, `${uniqueFirst}@stud.examflow.edu`);
    assert.match(res.body.user.matriculationNumber, /^MAT\d{4}\d{3}$/);
  });

  it("appends numeric suffixes on duplicate names", async () => {
    const first = await apiCreate({ name: `Dup${tag} One`, role: "student" });
    const second = await apiCreate({ name: `Dup${tag} Two`, role: "student" });
    const third = await apiCreate({ name: `Dup${tag} Three`, role: "student" });

    assert.equal(first.body.user.email, `dup${tag}@stud.examflow.edu`);
    assert.equal(second.body.user.email, `dup${tag}2@stud.examflow.edu`);
    assert.equal(third.body.user.email, `dup${tag}3@stud.examflow.edu`);
  });

  it("validates the payload (short password, admin role rejected)", async () => {
    const shortPw = await adminAgent
      .post("/admin/users")
      .send({ name: "X", role: "student", password: "short" });
    assert.equal(shortPw.status, 400);

    const adminRole = await adminAgent
      .post("/admin/users")
      .send({ name: "X", role: "admin", password: TEST_PASSWORD });
    assert.equal(adminRole.status, 400);
  });

  it("filters by role and paginates", async () => {
    const res = await adminAgent.get("/admin/users?role=student&page=1&pageSize=2");
    assert.equal(res.status, 200);
    assert.equal(res.body.pageSize, 2);
    assert.ok(res.body.users.length <= 2);
    assert.ok(res.body.users.every((u: { role: string }) => u.role === "student"));
    assert.ok(res.body.total >= 4);
  });

  it("deactivates and reactivates a user, blocking login while deactivated", async () => {
    const created = await apiCreate({ name: `Toggle${tag}`, role: "student" });
    const userId = created.body.user.id;
    const email = created.body.user.email;

    // Can log in before deactivation.
    const before = await request(app)
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    assert.equal(before.status, 200);

    const del = await adminAgent.delete(`/admin/users/${userId}`);
    assert.equal(del.status, 200);
    assert.ok(del.body.user.deactivatedAt);

    // Login now blocked with generic 401.
    const blocked = await request(app)
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    assert.equal(blocked.status, 401);

    const reactivated = await adminAgent.post(`/admin/users/${userId}/reactivate`);
    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.body.user.deactivatedAt, null);

    const after = await request(app)
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    assert.equal(after.status, 200);
  });

  it("ends an existing session for a deactivated account via /me", async () => {
    const created = await apiCreate({ name: `Session${tag}`, role: "teacher" });
    const userId = created.body.user.id;
    const agent = await agentFor(created.body.user.email);

    const okMe = await agent.get("/me");
    assert.equal(okMe.status, 200);

    await adminAgent.delete(`/admin/users/${userId}`);

    const blockedMe = await agent.get("/me");
    assert.equal(blockedMe.status, 401);
  });

  it("refuses to deactivate self or another admin", async () => {
    const self = await adminAgent.delete(`/admin/users/${adminId}`);
    assert.equal(self.status, 400);

    const otherAdmin = await createUser({
      name: "Other Admin",
      email: `oadmin-${tag}@examflow.edu`,
      role: "admin",
    });
    createdUserIds.push(otherAdmin.id);

    const res = await adminAgent.delete(`/admin/users/${otherAdmin.id}`);
    assert.equal(res.status, 403);
  });
});
