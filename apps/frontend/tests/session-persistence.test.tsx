import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp, submitLogin } from "./render";
import { TEST_USERS, requestCredentials, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("session persistence via HttpOnly cookie", () => {
  it("restores a session on load by calling /me (the cookie is never read by JS)", async () => {
    // Simulate a returning visitor whose browser still holds the HttpOnly cookie.
    seedSession(toPublic("teacher"));

    renderApp("/dashboard");

    // No login form: the app trusts the cookie via the /me round-trip.
    expect(await screen.findByText("teacher dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
    expect(requestCredentials["/me"]).toBe("include");
  });

  it("treats a missing/expired cookie (401 from /me) as logged out", async () => {
    seedSession(null);

    renderApp("/dashboard");

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("never stores the auth token in client-accessible storage", async () => {
    const account = TEST_USERS.admin;
    const { user } = renderApp("/login");

    await submitLogin(user, {
      audience: "staff",
      identifier: account.email,
      password: account.password,
    });
    await screen.findByText(`Welcome back, ${account.name}`);

    // The token lives only in the HttpOnly cookie; nothing leaks to JS storage.
    const storageDump = JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    });
    expect(storageDump).not.toMatch(/token/i);
    expect(storageDump).not.toMatch(/signed-token/);
  });

  it("clears the session on logout and blocks protected routes afterwards", async () => {
    seedSession(toPublic("admin"));
    const { user } = renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    await user.click(screen.getByRole("button", { name: /log out/i }));

    // After logout the server session is gone, so we land back on the login page.
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    await waitFor(() => expect(requestCredentials["/auth/logout"]).toBe("include"));
  });
});
