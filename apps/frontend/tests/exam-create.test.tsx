import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("exam creation", () => {
  it("creates a draft immediately and drops into the editor", async () => {
    seedSession(toPublic("teacher"));
    renderApp("/exams/new");

    // Lands in the Medium-style editor on a fresh "Untitled" draft.
    expect(await screen.findByDisplayValue("Untitled")).toBeInTheDocument();
    // With no questions yet, only the "+" add control shows (no heading/box).
    expect(screen.getByRole("button", { name: /add a question/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeDisabled();
  });

  it("offers a Create exam action from the dashboard", async () => {
    seedSession(toPublic("teacher"));
    const { user } = renderApp("/dashboard");

    await screen.findByText("teacher dashboard");
    const main = within(screen.getByRole("main"));
    await user.click(await main.findByRole("link", { name: /create exam/i }));

    expect(await screen.findByDisplayValue("Untitled")).toBeInTheDocument();
  });
});
