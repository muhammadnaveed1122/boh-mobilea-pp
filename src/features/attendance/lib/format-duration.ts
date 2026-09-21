function pad(n: number): string {
  return n < 10 ? `0${String(n)}` : String(n);
}

/**
 * Zero-padded hh:mm:ss for the live widget timer. Hours are not capped — an
 * open session that runs past 24 hours simply rolls into 25:00:00.
 */
export function formatDurationHMS(totalMs: number): string {
  const safe = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Human-friendly duration ("8h 48m", "23m"). Used for static, closed-session
 * display where seconds aren't meaningful.
 */
export function formatDurationCompact(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '—';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${String(minutes)}m`;
  return `${String(hours)}h ${pad(minutes)}m`;
}
