import type { LeadActivity } from '../../models/lead-activity';

export interface ActivityGroup {
  date: string;
  /** `DD.MM.YYYY` — matches the web date divider label. */
  dateLabel: string;
  activities: LeadActivity[];
}

function getDateParts(date: Date): { year: string; month: string; day: string } {
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
  };
}

/**
 * Groups activities into per-day buckets, preserving input order. Mirrors web
 * `groupActivitiesByDate` (see boh-lead-magnet) so the mobile timeline renders
 * the same `DD.MM.YYYY` date dividers. Uses the device-local calendar day
 * (mobile has no timezone selector, unlike web).
 */
export function groupActivitiesByDate(activities: LeadActivity[]): ActivityGroup[] {
  const groupMap = new Map<string, LeadActivity[]>();

  for (const activity of activities) {
    const { year, month, day } = getDateParts(new Date(activity.createdAt));
    const date = `${year}-${month}-${day}`;
    const existing = groupMap.get(date);
    if (existing) {
      existing.push(activity);
    } else {
      groupMap.set(date, [activity]);
    }
  }

  return Array.from(groupMap.entries()).map(([date, items]) => {
    const [year = '', month = '', day = ''] = date.split('-');
    return { date, dateLabel: `${day}.${month}.${year}`, activities: items };
  });
}
