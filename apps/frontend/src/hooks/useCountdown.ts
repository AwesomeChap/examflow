import { useEffect, useState } from "react";

/**
 * Counts down from an absolute deadline. Calls `onExpire` once when time runs out.
 */
export function useCountdown(deadline: string | null, onExpire?: () => void) {
  const [remainingMs, setRemainingMs] = useState(() =>
    deadline ? Math.max(0, new Date(deadline).getTime() - Date.now()) : 0,
  );
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const ms = Math.max(0, new Date(deadline).getTime() - Date.now());
      setRemainingMs(ms);
      if (ms <= 0 && !expired) {
        setExpired(true);
        onExpire?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadline, expired, onExpire]);

  return { remainingMs, expired };
}
