import { useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { BackButton } from '@/components/atoms/BackButton';
import { Button } from '@/components/atoms/Button';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { ATTENDANCE_STRINGS } from '../constants';
import { useAttendanceList } from '../hooks/use-attendance-list';
import { formatDurationCompact } from '../lib/format-duration';
import type { AttendanceListQuery, AttendanceRecord } from '../types';
import { AttendanceDayRow, type DayGroup } from './AttendanceListRow';
import {
  AttendanceRangeChips,
  buildPresetRange,
  type DateRange,
  type RangePreset,
} from './AttendanceRangeChips';
import { AttendanceRangeSheet, type AttendanceRangeSheetHandle } from './AttendanceRangeSheet';

interface Stats {
  totalDays: number;
  totalSeconds: number;
}

function groupByDay(items: AttendanceRecord[]): DayGroup[] {
  const byDate = new Map<string, DayGroup>();
  for (const item of items) {
    const key = item.attendanceDate.slice(0, 10);
    const existing = byDate.get(key);
    if (existing) {
      existing.sessions.push(item);
      existing.totalDurationSeconds += item.durationSeconds ?? 0;
      if (item.isOpen) existing.hasOpenSession = true;
    } else {
      byDate.set(key, {
        attendanceDate: item.attendanceDate,
        sessions: [item],
        totalDurationSeconds: item.durationSeconds ?? 0,
        hasOpenSession: item.isOpen,
      });
    }
  }
  for (const g of byDate.values()) {
    g.sessions.sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
  }
  return Array.from(byDate.values()).sort(
    (a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime(),
  );
}

function computeStats(groups: DayGroup[]): Stats {
  let totalSeconds = 0;
  for (const g of groups) totalSeconds += g.totalDurationSeconds;
  return { totalDays: groups.length, totalSeconds };
}

export function AttendanceListScreen() {
  const insets = useSafeAreaInsets();
  const muted = useThemeColor('--muted-foreground');

  const initial = useMemo<DateRange>(() => buildPresetRange('this_month'), []);
  const [activePreset, setActivePreset] = useState<RangePreset>('this_month');
  const [range, setRange] = useState<DateRange>(initial);
  const [page, setPage] = useState(1);
  const sheetRef = useRef<AttendanceRangeSheetHandle>(null);

  const queryParams: AttendanceListQuery = {
    page,
    limit: 100,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
  const query = useAttendanceList(queryParams);

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const meta = query.data?.meta;
  const groups = useMemo(() => groupByDay(items), [items]);
  const stats = useMemo(() => computeStats(groups), [groups]);
  const avgPerDay = stats.totalDays === 0 ? null : Math.floor(stats.totalSeconds / stats.totalDays);

  const onChipSelect = (preset: RangePreset, next: DateRange | null): void => {
    if (preset === 'custom') {
      sheetRef.current?.open(range);
      return;
    }
    if (next) {
      setActivePreset(preset);
      setRange(next);
      setPage(1);
    }
  };

  const onApplyCustom = (next: DateRange): void => {
    setActivePreset('custom');
    setRange(next);
    setPage(1);
  };

  const headerSubtitle = `${format(new Date(range.dateFrom), 'PP')} – ${format(new Date(range.dateTo), 'PP')}`;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="border-b border-border px-4 pb-3 pt-2">
        <View className="flex-row items-center gap-3">
          <BackButton />
          <View className="flex-1">
            <Text variant="heading">{ATTENDANCE_STRINGS.attendance}</Text>
            <Text variant="muted" className="text-xs">
              {headerSubtitle}
            </Text>
          </View>
          <Icon name="Calendar" size={20} color={muted} />
        </View>
      </View>

      <AttendanceRangeChips active={activePreset} onSelect={onChipSelect} />

      <View className="flex-row gap-2 border-b border-border bg-card/40 px-4 py-3">
        <View className="flex-1">
          <Text variant="muted" className="text-xs">
            {ATTENDANCE_STRINGS.totalDays}
          </Text>
          <Text className="text-lg font-semibold">{stats.totalDays}</Text>
        </View>
        <View className="flex-1">
          <Text variant="muted" className="text-xs">
            {ATTENDANCE_STRINGS.totalHours}
          </Text>
          <Text className="text-lg font-semibold">{formatDurationCompact(stats.totalSeconds)}</Text>
        </View>
        <View className="flex-1">
          <Text variant="muted" className="text-xs">
            {ATTENDANCE_STRINGS.avgDuration}
          </Text>
          <Text className="text-lg font-semibold">{formatDurationCompact(avgPerDay)}</Text>
        </View>
      </View>

      <FlatList
        className="flex-1"
        data={groups}
        keyExtractor={(g) => g.attendanceDate}
        renderItem={({ item }) => <AttendanceDayRow group={item} />}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && !query.isPlaceholderData}
            onRefresh={() => {
              query.refetch().catch(() => {});
            }}
          />
        }
        ListEmptyComponent={
          query.isLoading ? null : (
            <EmptyState
              icon="CalendarX"
              title={ATTENDANCE_STRINGS.empty}
              description={query.isError ? ATTENDANCE_STRINGS.failedToLoad : undefined}
            />
          )
        }
        ListFooterComponent={
          meta && meta.totalPages > page ? (
            <View className="p-4">
              <Button variant="ghost" onPress={() => setPage((p) => p + 1)}>
                <Text>{ATTENDANCE_STRINGS.loadOlder}</Text>
              </Button>
            </View>
          ) : null
        }
      />

      <AttendanceRangeSheet ref={sheetRef} onApply={onApplyCustom} />
    </View>
  );
}
