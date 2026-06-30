import { useEffect, useRef, useState } from "react";

function msUntil(deadline: string): number {
  return Math.max(0, new Date(deadline).getTime() - Date.now());
}

/**
 * Counts down from an absolute deadline. Calls `onExpire` once when time runs out.
 * Remaining time is derived from the deadline on each render so there is no
 * stale 00:00 flash while the attempt is still loading.
 */
export function useCountdown(deadline: string | null, onExpire?: () => void) {
  const [, tick] = useState(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expiredRef.current = false;
    if (!deadline) return;

    const pulse = () => {
      tick((n) => n + 1);
      if (msUntil(deadline) <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    pulse();
    const id = window.setInterval(pulse, 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  const remainingMs = deadline ? msUntil(deadline) : 0;

  return { remainingMs, expired: expiredRef.current };
}
