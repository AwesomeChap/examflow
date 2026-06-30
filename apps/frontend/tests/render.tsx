import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { AuthProvider } from "../src/auth/AuthProvider";
import { ThemeProvider } from "../src/context/ThemeProvider";
import { createStore } from "../src/store/store";

type UserEventInstance = ReturnType<typeof userEvent.setup>;

/** Fills and submits the login form, selecting the Student/Staff tab first. */
export async function submitLogin(
  user: UserEventInstance,
  options: { audience: "student" | "staff"; identifier: string; password: string },
) {
  if (options.audience === "staff") {
    await user.click(screen.getByRole("radio", { name: /staff/i }));
  }
  const identifierLabel = options.audience === "staff" ? /email/i : /matriculation number/i;
  await user.type(screen.getByLabelText(identifierLabel), options.identifier);
  await user.type(screen.getByLabelText(/^password$/i), options.password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

/**
 * Renders the real application (router + providers) starting at `route`,
 * mirroring `main.tsx` but with an in-memory history so individual entry
 * points can be exercised in tests.
 */
export function renderApp(route = "/") {
  const user = userEvent.setup();
  const store = createStore();
  const view = render(
    <Provider store={store}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  );
  return { user, store, ...view };
}

/** Renders an arbitrary element wrapped in the app providers. */
export function renderWithProviders(ui: ReactElement, route = "/") {
  const user = userEvent.setup();
  const store = createStore();
  const view = render(
    <Provider store={store}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  );
  return { user, store, ...view };
}
