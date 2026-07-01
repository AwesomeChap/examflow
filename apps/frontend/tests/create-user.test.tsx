import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, capturedRequests, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("create user flow", () => {
  it("submits the payload and shows the generated identifiers", async () => {
    seedSession(toPublic("admin"));
    const { user } = renderApp("/users/new");

    await screen.findByRole("heading", { name: /create user/i });

    await user.type(screen.getByLabelText(/full name/i), "Alice Johnson");
    // Role defaults to student.
    await user.type(screen.getByLabelText(/initial password/i), "sup3rsecret");
    await user.click(screen.getByRole("button", { name: /^create user$/i }));

    // The client sends exactly name/role/password.
    expect(capturedRequests.userCreate).toEqual([
      { name: "Alice Johnson", role: "student", password: "sup3rsecret" },
    ]);

    // A success toast surfaces the generated email + matriculation.
    const status = await screen.findByText(/alice@stud\.examflow\.edu/i);
    expect(status).toHaveTextContent(/MAT\d{7}/);

    // Returns to the dashboard.
    expect(await screen.findByText("admin dashboard")).toBeInTheDocument();
  });

  it("creates a teacher with a staff email and no matriculation", async () => {
    seedSession(toPublic("admin"));
    const { user } = renderApp("/users/new");

    await screen.findByRole("heading", { name: /create user/i });

    await user.type(screen.getByLabelText(/full name/i), "Bob Brown");
    await user.click(screen.getByRole("radio", { name: /teacher/i }));
    await user.type(screen.getByLabelText(/initial password/i), "teacherpass1");
    await user.click(screen.getByRole("button", { name: /^create user$/i }));

    expect(capturedRequests.userCreate).toEqual([
      { name: "Bob Brown", role: "teacher", password: "teacherpass1" },
    ]);

    const toast = await screen.findByText(/bob@examflow\.edu/i);
    expect(toast).toBeInTheDocument();
  });

  it("keeps the create-user route away from teachers", async () => {
    seedSession(toPublic("teacher"));
    renderApp("/users/new");

    // Guarded route redirects non-admins to their dashboard.
    expect(await screen.findByText("teacher dashboard")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("heading", { name: /create user/i })).not.toBeInTheDocument();
  });
});
