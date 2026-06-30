import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { cn } from "../lib/cn";
import type { UserRole } from "../types/user";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/Button";
import { Container } from "./ui/Container";

type NavItem = {
  to: string;
  label: string;
  /** Roles allowed to see the link. Undefined means every signed-in role. */
  roles?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/admin", label: "Admin", roles: ["admin"] },
  { to: "/teacher", label: "Teacher", roles: ["admin", "teacher"] },
  { to: "/student", label: "Student", roles: ["student"] },
];

export function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <nav
      aria-label="Primary"
      className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <Container className="flex items-center gap-3 py-3 sm:gap-6">
        <Link to="/dashboard" className="shrink-0" aria-label="ExamFlow home">
          <Logo />
        </Link>

        <ul className="flex items-center gap-1">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span
            className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400"
            data-testid="current-user"
          >
            {user.name} ({user.role})
          </span>
          <ThemeToggle />
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </Container>
    </nav>
  );
}
