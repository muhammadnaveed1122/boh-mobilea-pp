import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Sparkline } from '@/components/atoms/Sparkline';
import { Text } from '@/components/atoms/Text';
import { dubaiToday } from '@/lib/format/dubai';
import { useThemeColor } from '@theme';

import { useOverview } from '../hooks/use-overview';
import type { OverviewTrend, TrendDirection } from '../types';

interface TileProps {
  value: number;
  label: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
  href: string;
  /** What the trend % is measured against, e.g. "vs prev 30 days". */
  trendLabel?: string;
  /** Absent for the agent tiles — presence is live-only and has no history to draw. */
  trend?: OverviewTrend;
}

/** 1284 → "1,284"; 12400 → "12.4K". Long raw digits are hard to scan at tile size. */
function formatCount(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  if (value < 10_000) {
    return value.toLocaleString('en-US');
  }
  return `${(value / 1000).toFixed(value < 100_000 ? 1 : 0)}K`;
}

const TREND_ICON: Record<TrendDirection, IconName> = {
  up: 'TrendingUp',
  down: 'TrendingDown',
  flat: 'Minus',
};

const TREND_TEXT: Record<TrendDirection, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

const TREND_TOKEN: Record<TrendDirection, '--success' | '--destructive' | '--muted-foreground'> = {
  up: '--success',
  down: '--destructive',
  flat: '--muted-foreground',
};

/**
 * KPI tile: label, count, sparkline, and a trend pill — the same visual language as the
 * Leads page KPI cards (`features/leads/components/dashboard/KpiCard`), which is what the
 * super admin is used to reading.
 *
 * The trend arrow is an ICON as well as a colour: colour alone fails colourblind users.
 *
 * The agent tiles pass no `trend` — socket presence is never persisted, so there is no
 * history behind it. Drawing a line there would be inventing data.
 *
 * Plain `style={({pressed}) => ...}` rather than the `active:` NativeWind variant —
 * `active:` stalls the native UI thread on rapidly-tapped Pressables (known issue here).
 */
function StatTile({
  value,
  label,
  icon,
  iconBg,
  iconColor,
  href,
  trend,
  trendLabel,
}: Readonly<TileProps>) {
  const direction: TrendDirection = trend?.direction ?? 'flat';
  const sparkColor = useThemeColor(TREND_TOKEN[direction]);

  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={
        trend
          ? `${label}, ${value}, trending ${direction} ${Math.abs(trend.percent)} percent`
          : `${label}, ${value}`
      }
      className="flex-1 gap-1 rounded-xl border border-border bg-card px-3 py-2.5"
    >
      <View className="flex-row items-center gap-1.5">
        <View className={`h-6 w-6 items-center justify-center rounded-md ${iconBg}`}>
          <Icon name={icon} size={13} color={iconColor} />
        </View>
        <Text className="flex-1 text-[11px] leading-tight text-muted-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View className="flex-row items-end justify-between">
        <Text
          className="text-xl font-bold leading-tight text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatCount(value)}
        </Text>
        {trend ? (
          <Sparkline data={trend.sparkline} color={sparkColor} width={52} height={20} />
        ) : null}
      </View>

      {trend ? (
        <View className="flex-row items-center gap-1">
          <Icon name={TREND_ICON[direction]} size={11} color={sparkColor} />
          <Text className={`text-[11px] font-medium ${TREND_TEXT[direction]}`}>
            {Math.abs(trend.percent)}%
          </Text>
          {trendLabel ? (
            <Text className="flex-1 text-[10px] text-muted-foreground" numberOfLines={1}>
              {trendLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Chunk tiles into rows of two so the grid wraps cleanly. */
function chunkPairs(tiles: readonly ReactElement[]): ReactElement[][] {
  const rows: ReactElement[][] = [];
  for (let i = 0; i < tiles.length; i += 2) {
    rows.push(tiles.slice(i, i + 2));
  }
  return rows;
}

/** Must match the real tile height or the grid jumps when data lands. */
function TilesSkeleton() {
  return (
    <View className="gap-2 px-4">
      {[0, 1, 2].map((row) => (
        <View key={row} className="flex-row gap-2">
          <Skeleton className="h-[86px] flex-1 rounded-xl" />
          <Skeleton className="h-[86px] flex-1 rounded-xl" />
        </View>
      ))}
    </View>
  );
}

/**
 * Super-admin home stat grid: six tap-through tiles (total/today leads,
 * total/today listings, online/offline agents). Each tile is a Pressable
 * routing to the filtered list/agents screen. "Today's Leads" (created
 * today) is a distinct metric from the existing "New Leads" tile (status
 * === New) on the staff home dashboard — do not conflate the two.
 */
export function SuperAdminStatTiles() {
  const { data, isLoading } = useOverview();
  const foreground = useThemeColor('--foreground');
  const success = useThemeColor('--success');
  const mutedForeground = useThemeColor('--muted-foreground');
  // Dubai calendar day, NOT the UTC one — `toISOString()` would link to
  // yesterday between 00:00 and 04:00 Dubai. The backend anchors day-windows
  // to +04:00, so the tile and the list must agree on which day "today" is.
  const today = dubaiToday();

  if (isLoading) {
    return <TilesSkeleton />;
  }

  const tiles: ReactElement[] = [
    <StatTile
      key="total-leads"
      value={data?.totalLeads ?? 0}
      label="Total Leads"
      icon="Users"
      iconBg="bg-muted"
      iconColor={foreground}
      href="/leads/all"
      trend={data?.trends?.totalLeads}
      trendLabel="vs prev 30 days"
    />,
    <StatTile
      key="today-leads"
      value={data?.todayLeads ?? 0}
      label="Today's Leads"
      icon="UserPlus"
      iconBg="bg-muted"
      iconColor={foreground}
      href={`/leads/all?dateFrom=${today}&dateTo=${today}`}
      trend={data?.trends?.todayLeads}
      trendLabel="vs yesterday"
    />,
    <StatTile
      key="total-listings"
      value={data?.totalListings ?? 0}
      label="Total Listings"
      icon="Building2"
      iconBg="bg-muted"
      iconColor={foreground}
      href="/listings"
      trend={data?.trends?.totalListings}
      trendLabel="vs prev 30 days"
    />,
    <StatTile
      key="today-listings"
      value={data?.todayListings ?? 0}
      label="Today's Listings"
      icon="CalendarPlus"
      iconBg="bg-muted"
      iconColor={foreground}
      href={`/listings?dateFrom=${today}&dateTo=${today}`}
      trend={data?.trends?.todayListings}
      trendLabel="vs yesterday"
    />,
    <StatTile
      key="online-agents"
      value={data?.onlineAgents ?? 0}
      label="Online Agents"
      icon="UserCheck"
      iconBg="bg-success/10"
      iconColor={success}
      href="/agents?tab=online"
    />,
    <StatTile
      key="offline-agents"
      value={data?.offlineAgents ?? 0}
      label="Offline Agents"
      icon="UserX"
      iconBg="bg-muted"
      iconColor={mutedForeground}
      href="/agents?tab=offline"
    />,
  ];

  return (
    <View className="gap-2 px-4">
      {chunkPairs(tiles).map((row) => (
        <View key={row.map((t) => t.key).join('-')} className="flex-row gap-2">
          {row}
        </View>
      ))}
    </View>
  );
}
