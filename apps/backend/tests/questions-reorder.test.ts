import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { agentFor, createWorld, prisma, type World } from "./helpers.js";

describe("POST /exams/:examId/questions/reorder", () => {
  let world: World;
  let examId: string;
  let ids: string[];

  before(async () => {
    world = await createWorld();
    const agent = await agentFor(world.teacherA.email);

    const exam = await agent.post("/exams").send({ title: `Reorder ${world.tag}` });
    examId = exam.body.exam.id;

    ids = [];
    for (let i = 1; i <= 3; i += 1) {
      const res = await agent
        .post(`/exams/${examId}/questions`)
        .send({ type: "true_false", text: `Q${i}`, correctAnswer: "true" });
      ids.push(res.body.question.id);
    }
  });

  after(async () => {
    await world.cleanup();
    await prisma.$disconnect();
  });

  it("rewrites the order to match the provided id sequence", async () => {
    const agent = await agentFor(world.teacherA.email);
    const reversed = [...ids].reverse();

    const res = await agent
      .post(`/exams/${examId}/questions/reorder`)
      .send({ orderedIds: reversed });

    assert.equal(res.status, 200);
    const returned = res.body.questions.map((q: { id: string }) => q.id);
    assert.deepEqual(returned, reversed);
    assert.deepEqual(
      res.body.questions.map((q: { order: number }) => q.order),
      [1, 2, 3],
    );
  });

  it("rejects a list that is not a full permutation (400)", async () => {
    const agent = await agentFor(world.teacherA.email);
    const res = await agent
      .post(`/exams/${examId}/questions/reorder`)
      .send({ orderedIds: [ids[0], ids[1]] });
    assert.equal(res.status, 400);
  });

  it("forbids a non-owning teacher (404)", async () => {
    const agent = await agentFor(world.teacherB.email);
    const res = await agent
      .post(`/exams/${examId}/questions/reorder`)
      .send({ orderedIds: [...ids].reverse() });
    assert.equal(res.status, 404);
  });
});
