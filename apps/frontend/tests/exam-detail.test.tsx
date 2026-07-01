import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedExams, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("exam detail", () => {
  it("renders exam details with an empty analytics section", async () => {
    seedSession(toPublic("teacher"));
    seedExams([
      makeExam({
        id: "d1",
        title: "Algebra Midterm",
        description: "Covers chapters 1–4.",
        durationMin: 90,
        status: "published",
      }),
    ]);
    renderApp("/exam/d1/details");

    expect(await screen.findByRole("heading", { name: "Algebra Midterm" })).toBeInTheDocument();
    expect(screen.getByText("Covers chapters 1–4.")).toBeInTheDocument();
    expect(screen.getByText("90 minutes")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    // With no submissions yet, the analytics section shows its empty state.
    expect(await screen.findByRole("heading", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument();
  });

  it("shows a not-found message for an inaccessible exam", async () => {
    seedSession(toPublic("teacher"));
    seedExams([
      makeExam({ id: "owned-by-other", title: "Hidden", createdById: "someone-else" }),
    ]);
    renderApp("/exam/owned-by-other/details");

    expect(await screen.findByRole("alert")).toHaveTextContent(/not found|do not have access/i);
  });
});
