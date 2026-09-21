import { View } from 'react-native';
import { useThemeColor } from '@theme';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { OverviewKpi, TrendDirection } from '../../types';
import { Sparkline } from './Sparkline';

const TREND_ICON: Record<TrendDirection, 'TrendingUp' | 'TrendingDown' | 'Minus'> = {
  up: 'TrendingUp',
  down: 'TrendingDown',
  flat: 'Minus',
};

const TREND_TEXT: Record<TrendDirection, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

/**
 * One compact KPI tile. Sizing is the caller's job — `width` is required
 * because the card lives in a horizontal rail, where flex sizing collapses.
 */
export function KpiCard({ kpi, width }: Readonly<{ kpi: OverviewKpi; width: number }>) {
  const direction: TrendDirection = kpi.trend?.direction ?? 'flat';
  const sparkColor = useThemeColor(
    direction === 'up'
      ? '--success'
      : direction === 'down'
        ? '--destructive'
        : '--muted-foreground',
  );
  const percent = kpi.trend?.percent ?? 0;

  return (
    <View
      className="rounded-xl border border-border bg-card px-2.5 py-2"
      style={{ width, elevation: 1 }}
    >
      <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
        {kpi.label}
      </Text>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-lg font-bold leading-6 text-foreground" numberOfLines={1}>
          {kpi.count}
        </Text>
        <Sparkline data={kpi.trend?.sparkline ?? []} color={sparkColor} width={36} height={14} />
      </View>
      <View className="flex-row items-center gap-0.5">
        <Icon name={TREND_ICON[direction]} size={10} color={sparkColor} />
        <Text className={`text-[10px] font-medium ${TREND_TEXT[direction]}`}>
          {Math.abs(percent)}%
        </Text>
      </View>
    </View>
  );
}
