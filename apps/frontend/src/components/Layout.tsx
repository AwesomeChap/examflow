import { Outlet } from "react-router-dom";
import { Container } from "./ui/Container";
import { Navigation } from "./Navigation";

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus:bg-slate-900"
      >
        Skip to main content
      </a>
      <Navigation />
      <main id="main-content" tabIndex={-1} className="focus-visible:outline-none">
        <Container className="py-8 sm:py-10">
          <Outlet />
        </Container>
      </main>
    </div>
  );
}
