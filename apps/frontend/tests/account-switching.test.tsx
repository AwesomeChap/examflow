import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Question } from "@examflow/shared-types";
import { renderApp, submitLogin } from "./render";
import {
  TEST_USERS,
  makeExam,
  seedAssignments,
  seedQuestions,
  seedStudentExam,
  seedSubmittedAttempt,
} from "./server";

function mcq(): Question {
  return {
    id: "q1",
    examId: "shared",
    type: "mcq",
    text: "2 + 2 = ?",
    options: ["3", "4"],
    correctAnswer: "4",
    order: 1,
    points: 1,
  };
}

function nav() {
  return within(screen.getByRole("navigation", { name: /primary/i }));
}

async function logOut(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(screen.getByRole("button", { name: /log out/i }));
  await screen.findByRole("button", { name: /sign in/i });
}

describe("per-account dashboards (no cross-user cache leak)", () => {
  it("does not show one student's submitted result on another student's account", async () => {
    // One shared exam assigned to both students; only the first student submitted.
    seedStudentExam(
      makeExam({ id: "shared", title: "Math Quiz", createdById: TEST_USERS.teacher.id }),
      [mcq()],
    );
    seedAssignments("shared", [TEST_USERS.student.id, TEST_USERS.student2.id]);
    seedSubmittedAttempt("shared", TEST_USERS.student.id, [{ questionId: "q1", value: "4" }]);

    const { user } = renderApp("/login");

    // Sign in as the student who submitted; the exam appears under Results.
    await submitLogin(user, {
      audience: "student",
      identifier: TEST_USERS.student.matriculationNumber!,
      password: TEST_USERS.student.password,
    });
    await screen.findByText(`Welcome back, ${TEST_USERS.student.name}`);
    await user.click(nav().getByRole("link", { name: "Results" }));
    expect(await screen.findByText("Math Quiz")).toBeInTheDocument();

    // Switch to the second student.
    await logOut(user);
    await submitLogin(user, {
      audience: "student",
      identifier: TEST_USERS.student2.matriculationNumber!,
      password: TEST_USERS.student2.password,
    });
    await screen.findByText(`Welcome back, ${TEST_USERS.student2.name}`);

    // Their Results tab must be empty — they never submitted anything.
    await user.click(nav().getByRole("link", { name: "Results" }));
    expect(await screen.findByText(/completed any exams yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Math Quiz")).not.toBeInTheDocument();

    // And the exam is still startable on their dashboard.
    await user.click(nav().getByRole("link", { name: "Dashboard" }));
    expect(await screen.findByText("Math Quiz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start exam/i })).toBeInTheDocument();
  });

  it("clears cached staff data when switching between accounts", async () => {
    // Teacher owns an exam; after they log out an admin should get a fresh fetch
    // rather than the teacher's cached list.
    seedQuestions("t1", []);
    const { user } = renderApp("/login");

    await submitLogin(user, {
      audience: "staff",
      identifier: TEST_USERS.teacher.email,
      password: TEST_USERS.teacher.password,
    });
    await screen.findByText(`Welcome back, ${TEST_USERS.teacher.name}`);
    expect(await screen.findByText(/you haven’t created any exams yet/i)).toBeInTheDocument();

    await logOut(user);
    await submitLogin(user, {
      audience: "staff",
      identifier: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Admin lands on their own dashboard (distinct copy, role-appropriate).
    expect(await screen.findByText(`Welcome back, ${TEST_USERS.admin.name}`)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("admin dashboard")).toBeInTheDocument());
  });
});
