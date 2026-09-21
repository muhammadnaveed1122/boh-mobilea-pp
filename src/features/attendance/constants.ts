/**
 * User-facing strings for the attendance feature.
 *
 * Centralized so a future i18n migration touches one file — mobile has no
 * translation system today (no t() calls anywhere in the repo).
 */
export const ATTENDANCE_STRINGS = {
  attendance: 'Attendance',
  checkIn: 'Check in',
  checkInAgain: 'Check in again',
  checkOut: 'Check out',
  viewHistory: 'View history',
  retry: 'Retry',
  loadOlder: 'Load older',
  open: 'Open',
  ready: 'Ready to start your day?',
  alreadyCheckedIn: 'Already checked in today',
  failedToLoad: 'Failed to load attendance. Pull to retry.',
  empty: 'No attendance records in this range.',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  last7Days: 'Last 7 days',
  customRange: 'Custom range',
  apply: 'Apply',
  cancel: 'Cancel',
  from: 'From',
  to: 'To',
  totalDays: 'Days',
  totalHours: 'Hours',
  avgDuration: 'Avg / day',
} as const;
