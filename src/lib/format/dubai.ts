/**
 * Dubai (Asia/Dubai, UTC+04:00) calendar helpers.
 *
 * This is a Dubai business: "today" is the Dubai calendar day, and the backend
 * anchors every day-window to +04:00. `new Date().toISOString()` gives the UTC
 * date, which is YESTERDAY between 00:00 and 04:00 Dubai — so it must never be
 * used to build a `dateFrom`/`dateTo` day filter.
 *
 * The UAE has no DST and has been a fixed +04:00 since 1972, so a constant
 * offset is exact — no `Intl`/tz-database dependency needed (Hermes ships a
 * trimmed ICU).
 */

import { addMinutes, format, isValid, parseISO } from 'date-fns';

const DUBAI_UTC_OFFSET_MINUTES = 4 * 60;

/** The instant `now`, shifted so its LOCAL calendar fields read as Dubai's. */
function toDubaiWallClock(now: Date): Date {
  // getTimezoneOffset() is minutes to ADD to local time to reach UTC.
  return addMinutes(now, DUBAI_UTC_OFFSET_MINUTES + now.getTimezoneOffset());
}

/** Dubai's current calendar date as `YYYY-MM-DD` (the `dateFrom`/`dateTo` format). */
export function dubaiToday(now: Date = new Date()): string {
  return format(toDubaiWallClock(now), 'yyyy-MM-dd');
}

/** "14 Jul" — short label for a `YYYY-MM-DD` day filter. Empty string if unparseable. */
export function formatDayLabel(isoDay: string | undefined): string {
  if (isoDay === undefined || isoDay === '') return '';
  const parsed = parseISO(isoDay);
  return isValid(parsed) ? format(parsed, 'd MMM') : '';
}
