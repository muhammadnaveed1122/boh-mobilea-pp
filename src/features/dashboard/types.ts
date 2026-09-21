export type TrendDirection = 'up' | 'down' | 'flat';

/** Same shape the leads KPI cards already consume (`KpiTrendDto` on the backend). */
export interface OverviewTrend {
  percent: number;
  direction: TrendDirection;
  sparkline: number[];
}

export interface DashboardOverview {
  totalLeads: number;
  todayLeads: number;
  totalListings: number;
  todayListings: number;
  onlineAgents: number;
  offlineAgents: number;
  /**
   * Only the four leads/listings metrics carry a trend. Agents deliberately do NOT:
   * socket presence is live-only and is never persisted, so there is no history to
   * draw — a sparkline there would be fabricated.
   */
  trends?: {
    totalLeads: OverviewTrend;
    todayLeads: OverviewTrend;
    totalListings: OverviewTrend;
    todayListings: OverviewTrend;
  };
}

export interface LeadFunnelStage {
  stage: string;
  label: string;
  count: number;
  pctOfTop: number;
}

export interface LeadFunnel {
  stages: LeadFunnelStage[];
  conversionRate: number;
}

export type FunnelPeriod = 'this-month' | 'last-month' | '3m' | '6m';
