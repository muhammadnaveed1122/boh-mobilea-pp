import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { formatDurationHMS } from '../lib/format-duration';

/**
 * Returns the elapsed time since `startAt` formatted as `hh:mm:ss`, ticking
 * once per second. Pauses the interval when the app is backgrounded and reads
 * `Date.now()` on tick, so coming back from background snaps to the real
 * elapsed time with no drift.
 *
 * Returns an empty string when `startAt` is null.
 */
export function useElapsedTime(startAt: string | Date | null | undefined): string {
  const startMs = startAt === null || startAt === undefined ? null : new Date(startAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startMs === null) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval !== null) return;
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), 1000);
    };

    const stop = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    };

    const onState = (state: AppStateStatus) => {
      if (state === 'active') start();
      else stop();
    };

    start();
    const sub = AppState.addEventListener('change', onState);

    return () => {
      stop();
      sub.remove();
    };
  }, [startMs]);

  if (startMs === null) return '';
  return formatDurationHMS(now - startMs);
}
