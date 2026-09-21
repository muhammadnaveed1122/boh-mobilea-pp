/**
 * App-wide date / time formatters backed by `date-fns`.
 *
 * All helpers accept `Date | string | number | null | undefined`. Invalid or
 * empty inputs return an empty string so callers can pipe API values through
 * without extra guards.
 */

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const date = typeof input === 'string' ? parseISO(input) : new Date(input);
  return isValid(date) ? date : null;
}

/** "04/12/2026" — calendar date, en-US locale. */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, 'MM/dd/yyyy') : '';
}

/** "11:00 AM" — 12-hour time with meridiem. */
export function formatTime(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, 'hh:mm a') : '';
}

/** "04/12/2026 11:00 AM" — full date + time. */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, 'MM/dd/yyyy hh:mm a') : '';
}

/** "04/12/2026 | 11:00 AM" — pipe-separated stamp used by message rows. */
export function formatStamp(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, 'MM/dd/yyyy | hh:mm a') : '';
}

/**
 * "2 hours ago" if recent (< 7 days), otherwise "MM/dd/yyyy hh:mm a".
 * Use for activity timestamps.
 */
export function formatRelative(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  const diffMs = Date.now() - d.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (diffMs >= 0 && diffMs < sevenDaysMs) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  return formatDateTime(d);
}
