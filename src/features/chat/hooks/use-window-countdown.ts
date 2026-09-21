import { useEffect, useState } from 'react';

/**
 * Live HH:MM countdown to an absolute expiry timestamp. Display-only — it never
 * decides gating (that is the server's `withinWindow`). Ported from the web
 * `useWindowCountdown`: a single shared 1s ticker drives every countdown on
 * screen, regardless of how many mount. The label is minute-resolution (seconds
 * are intentionally not shown), but the ticker stays at 1s so `isExpired` flips
 * the moment the window actually closes.
 */

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startTicker(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    const now = Date.now();
    listeners.forEach((fn) => fn(now));
  }, 1000);
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  startTicker();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/**
 * Milliseconds remaining → `HH:MM`, clamped at `00:00`. Minutes round up so a
 * window with 30s left reads `00:01` rather than a misleading `00:00`.
 */
function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}

export interface WindowCountdown {
  /** `HH:MM` remaining, or `00:00` once expired. */
  label: string;
  /** True once the expiry timestamp has passed. */
  isExpired: boolean;
  /** False when there is no window to count down (null expiry). */
  hasWindow: boolean;
}

export function useWindowCountdown(windowExpiresAt: string | null): WindowCountdown {
  const [now, setNow] = useState(() => Date.now());

  const hasWindow = windowExpiresAt !== null;

  useEffect(() => {
    if (!hasWindow) return;
    // Sync immediately so a fresh mount doesn't show a stale second.
    setNow(Date.now());
    return subscribe(setNow);
  }, [hasWindow, windowExpiresAt]);

  if (!hasWindow) {
    return { label: '00:00', isExpired: false, hasWindow: false };
  }

  const remaining = new Date(windowExpiresAt).getTime() - now;
  return {
    label: formatRemaining(remaining),
    isExpired: remaining <= 0,
    hasWindow: true,
  };
}
