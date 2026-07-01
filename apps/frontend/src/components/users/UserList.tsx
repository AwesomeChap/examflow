import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import {
  useDeactivateUserMutation,
  useGetUsersQuery,
  useReactivateUserMutation,
} from "../../store/usersApi";
import type { AdminUser } from "../../types/adminUser";
import type { UserRole } from "../../types/user";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Pagination } from "../ui/Pagination";

const PAGE_SIZE = 50;
const ROW_HEIGHT = 68;

const ROLE_TONE: Record<UserRole, "info" | "warning" | "neutral"> = {
  admin: "warning",
  teacher: "info",
  student: "neutral",
};

type UserListProps = {
  /** Role filter; undefined lists all roles. */
  role?: UserRole;
};

/**
 * Paginated + virtualized list of users for the admin panel. Server pagination
 * keeps payloads small; the current page's rows are virtualized so large pages
 * stay smooth.
 */
export function UserList({ role }: UserListProps) {
  const [page, setPage] = useState(1);

  // Reset to the first page whenever the role filter changes.
  useEffect(() => {
    setPage(1);
  }, [role]);

  const { data, isLoading, isFetching, isError } = useGetUsersQuery({
    page,
    pageSize: PAGE_SIZE,
    role,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const items = data?.items ?? [];
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading users…
      </p>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        Could not load users. Please try again.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No users found.
      </p>
    );
  }

  return (
    <div>
      <div
        ref={scrollRef}
        className="max-h-[32rem] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800"
        // aria-busy communicates background refetches (e.g. paging) to AT.
        aria-busy={isFetching}
      >
        <ul
          role="list"
          aria-label="Users"
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const user = items[row.index];
            return (
              <li
                key={user.id}
                data-index={row.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full border-b border-slate-100 last:border-b-0 dark:border-slate-800/70"
                style={{ transform: `translateY(${row.start}px)` }}
              >
                <UserRow user={user} />
              </li>
            );
          })}
        </ul>
      </div>

      <Pagination
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const [deactivate, { isLoading: deactivating }] = useDeactivateUserMutation();
  const [reactivate, { isLoading: reactivating }] = useReactivateUserMutation();
  const deactivated = user.deactivatedAt !== null;
  const busy = deactivating || reactivating;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
            {user.name}
          </span>
          <Badge tone={ROLE_TONE[user.role]}>{user.role}</Badge>
          {deactivated && <Badge tone="warning">Deactivated</Badge>}
        </div>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
          {user.email}
          {user.matriculationNumber ? ` · ${user.matriculationNumber}` : ""}
        </p>
      </div>

      {/* Admins are not manageable here; only teachers/students can be toggled. */}
      {user.role !== "admin" &&
        (deactivated ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => reactivate(user.id)}
          >
            {reactivating ? "Reactivating…" : "Reactivate"}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => deactivate(user.id)}
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            {deactivating ? "Deactivating…" : "Deactivate"}
          </Button>
        ))}
    </div>
  );
}
