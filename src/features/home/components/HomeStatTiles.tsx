import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useGlobalCallStats } from '@/features/callMonitoring/hooks/use-call-stats';
import { useFunnelStats } from '@/features/leads/hooks/use-funnel-stats';
import { useLeadsOverview } from '@/features/leads/hooks/use-leads-overview';
import { PERMISSIONS, useCan } from '@/lib/rbac';

interface TileProps {
  value: number;
  label: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  onPress?: () => void;
}

function StatTile({ value, label, icon, iconBg, iconColor, cardBg, onPress }: Readonly<TileProps>) {
  return (
    <Pressable onPress={onPress} className={`flex-1 rounded-2xl p-4 active:opacity-80 ${cardBg}`}>
      <View className="flex-row items-start justify-between">
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
        <View className="h-7 w-7 items-center justify-center rounded-full bg-card">
          <Icon name="ArrowUpRight" size={14} />
        </View>
      </View>
      <Text className="mt-6 text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

// Each tile owns its own query so a failing/permission-gated source never
// blocks the others, mirroring the LeadsHomeStatTiles pattern. Queries shared
// across tiles (funnel stats, leads overview) dedupe via TanStack's cache.

function TotalLeadsTile() {
  const { data } = useFunnelStats();
  const fg = useThemeColor('--brand-foreground');
  return (
    <StatTile
      value={data?.totalLeads ?? 0}
      label="Total Leads"
      icon="Users"
      iconBg="bg-brand"
      iconColor={fg}
      cardBg="bg-brand/10"
      onPress={() => router.push('/leads/all')}
    />
  );
}

function NewLeadsTile() {
  const { data } = useLeadsOverview();
  const fg = useThemeColor('--warning-foreground');
  const newCount = data?.pipelineCounts.find((p) => p.status === 'New')?.count ?? 0;
  return (
    <StatTile
      value={newCount}
      label="New Leads"
      icon="UserPlus"
      iconBg="bg-warning"
      iconColor={fg}
      cardBg="bg-warning/10"
      onPress={() => router.push('/leads/all?status=New')}
    />
  );
}

function MissedCallsTile() {
  const { data } = useGlobalCallStats({});
  const fg = useThemeColor('--destructive-foreground');
  return (
    <StatTile
      value={data?.missed_calls ?? 0}
      label="Missed Calls"
      icon="PhoneMissed"
      iconBg="bg-destructive"
      iconColor={fg}
      cardBg="bg-destructive/10"
      onPress={() => router.push('/calls')}
    />
  );
}

function AnsweredCallsTile() {
  const { data } = useGlobalCallStats({});
  const fg = useThemeColor('--success-foreground');
  return (
    <StatTile
      value={data?.answered_calls ?? 0}
      label="Answered Calls"
      icon="PhoneIncoming"
      iconBg="bg-success"
      iconColor={fg}
      cardBg="bg-success/10"
      onPress={() => router.push('/calls')}
    />
  );
}

/** Chunk visible tiles into rows of two so the grid wraps cleanly. */
function chunkPairs(tiles: readonly ReactElement[]): ReactElement[][] {
  const rows: ReactElement[][] = [];
  for (let i = 0; i < tiles.length; i += 2) {
    rows.push(tiles.slice(i, i + 2));
  }
  return rows;
}

/**
 * Home dashboard stat grid: total/new lead counts and missed/answered call
 * counts. Each tile is permission-gated and tap-to-navigate. Lead tiles need
 * leads read; call stats need `calls:monitor`.
 */
export function HomeStatTiles() {
  const canReadLeads = useCan([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  const canMonitorCalls = useCan(PERMISSIONS.CALLS_MONITOR);

  const tiles: ReactElement[] = [];
  if (canReadLeads) {
    tiles.push(<TotalLeadsTile key="total-leads" />, <NewLeadsTile key="new-leads" />);
  }
  if (canMonitorCalls) {
    tiles.push(<MissedCallsTile key="missed-calls" />, <AnsweredCallsTile key="answered-calls" />);
  }

  return (
    <View className="mt-4 gap-3 px-4">
      {chunkPairs(tiles).map((row) => (
        <View key={row.map((t) => t.key).join('-')} className="flex-row gap-3">
          {row}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}
