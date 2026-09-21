import { endOfMonth, startOfMonth, subMonths } from 'date-fns';

import { apiClient } from '@/lib/api';

import type { DashboardOverview, FunnelPeriod, LeadFunnel } from './types';

export async function getOverview(): Promise<DashboardOverview> {
  const { data } = await apiClient.get<DashboardOverview>('/api/v1/dashboard/overview');
  return data;
}

/**
 * Resolves a period to an inclusive [from, to] ISO window.
 *
 * "Last month" is a CLOSED window (1st → last day of the previous month), not a rolling
 * 30 days — it must not bleed into the current month or it stops being comparable with
 * "This month". The 3/6-month options are rolling windows ending now, which is what
 * people mean by "the last 3 months".
 *
 * Always send an explicit `from`: the backend defaults a missing `from` to the 1st of the
 * current month, so omitting it would silently return This Month for every option.
 */
function periodToRange(period: FunnelPeriod): { from: string; to: string } {
  const now = new Date();

  if (period === 'last-month') {
    const previous = subMonths(now, 1);
    return {
      from: startOfMonth(previous).toISOString(),
      to: endOfMonth(previous).toISOString(),
    };
  }

  if (period === '3m') {
    return { from: subMonths(now, 3).toISOString(), to: now.toISOString() };
  }

  if (period === '6m') {
    return { from: subMonths(now, 6).toISOString(), to: now.toISOString() };
  }

  return { from: startOfMonth(now).toISOString(), to: now.toISOString() };
}

export async function getLeadFunnel(period: FunnelPeriod): Promise<LeadFunnel> {
  const { data } = await apiClient.get<LeadFunnel>('/api/v1/dashboard/lead-funnel', {
    params: periodToRange(period),
  });
  return data;
}
