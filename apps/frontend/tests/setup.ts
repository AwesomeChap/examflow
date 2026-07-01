import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetSession, server } from "./server";

// Routes are code-split with React.lazy, so navigating to a page triggers an
// on-demand dynamic import. Under the full, parallel suite Vitest transforms
// those chunks on first use, which can exceed the default 1s `findBy` timeout on
// a busy machine. Give async queries more headroom so the split is transparent
// to tests (real browsers fetch prebuilt chunks near-instantly).
configure({ asyncUtilTimeout: 5000 });

// Node's experimental global `localStorage` shadows jsdom's and is unusable
// without `--localstorage-file`, so install a self-contained in-memory Storage.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, { configurable: true, value: storage });
  Object.defineProperty(window, name, { configurable: true, value: storage });
}

// jsdom does not implement matchMedia, which ThemeProvider relies on.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom performs no layout, so @tanstack/react-virtual would see a 0-size
// scroll container and render nothing. It measures via `offsetWidth/Height`, so
// report a usable viewport there (plus a no-op ResizeObserver).
for (const [prop, value] of [
  ["offsetHeight", 600],
  ["offsetWidth", 800],
  ["clientHeight", 600],
] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get() {
      return value;
    },
  });
}

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetSession();
  localStorage.clear();
});

afterAll(() => server.close());
