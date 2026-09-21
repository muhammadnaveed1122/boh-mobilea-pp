import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';
import { DialerFab, DIALER_FAB_SPACE } from '@/features/callService/components/DialerFab';
import { useCanDial } from '@/features/callService/hooks/use-can-dial';
import { useThemeColor } from '@theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useRefetchOnTabFocus, useInvalidateOnTabFocus } from '@/lib/tab-focus-refresh';
import type { SourceTabKey } from '../constants';
import { extractRecords, extractTotal, type CallRecord } from '../models/call-record';
import { useCallRecords } from '../hooks/use-call-records';
import { useCampaigns } from '../hooks/use-campaigns';
import { useGlobalCallStats, useScopedCallStats } from '../hooks/use-call-stats';
import { useDncCheck } from '../hooks/use-dnc-check';
import { useRecordingPlayer } from '../hooks/use-recording-player';
import { useCallExport } from '../hooks/use-call-export';
import { outcomeBadge } from '../utils/call-format';
import { CallFilterSheet, type CallFilterDraft } from './CallFilterSheet';
import { CallList } from './CallList';
import { SearchFilterRow } from '@/components/molecules';
import { SourceTabs } from './SourceTabs';
import { StatsRow } from './StatsRow';

function countActive(f: CallFilterDraft): number {
  return Object.values(f).filter((v) => v !== undefined && v !== '').length;
}

export function CallMonitoringScreen() {
  const insets = useSafeAreaInsets();
  const perm = useRequirePermission(PERMISSIONS.CALLS_READ);
  const player = useRecordingPlayer();
  const exportIconColor = useThemeColor('--primary-foreground');
  const { exportCsv, exporting } = useCallExport();
  const canDial = useCanDial();

  const [tab, setTab] = useState<SourceTabKey>('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<CallFilterDraft>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);

  const serverFilters = useMemo(
    () => ({
      source: tab || undefined,
      search: debouncedSearch || undefined,
      direction: filters.direction || undefined,
      agentExtension: filters.agentExtension || undefined,
      // campaignId only applies on the Campaigns tab (server filter).
      campaignId: tab === 'telesales' ? filters.campaignId || undefined : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [tab, debouncedSearch, filters],
  );

  // Telesales campaigns — drive the Campaigns-tab filter pills.
  const { data: campaigns } = useCampaigns();
  const campaignOptions = useMemo(
    () => (campaigns ?? []).map((c) => ({ value: c.id, label: c.name })),
    [campaigns],
  );

  const range = { from: filters.from, to: filters.to };
  const { data: globalStats } = useGlobalCallStats(range);
  const { data: scopedStats } = useScopedCallStats(range, tab);
  const stats = tab !== '' ? (scopedStats ?? globalStats) : globalStats;

  const recordsQuery = useCallRecords(serverFilters);
  useRefetchOnTabFocus([recordsQuery]);
  useInvalidateOnTabFocus([['call-stats']]);

  const allRecords = useMemo<CallRecord[]>(() => {
    const flat = recordsQuery.data?.pages.flatMap((p) => extractRecords(p)) ?? [];
    const seen = new Set<string>();
    return flat.filter((r) => {
      const key = r.id || r.uuid;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recordsQuery.data]);
  const total = extractTotal(recordsQuery.data?.pages.at(-1), allRecords.length);

  // Client-side filters (parity with web): outcome + department.
  const records = useMemo(
    () =>
      allRecords.filter((r) => {
        if (filters.outcome && outcomeBadge(r.status).label !== filters.outcome) return false;
        if (filters.department && (r.extension?.department?.name ?? '') !== filters.department)
          return false;
        return true;
      }),
    [allRecords, filters.outcome, filters.department],
  );

  // DNC batch check for caller numbers on loaded pages.
  const phoneList = useMemo(
    () =>
      Array.from(
        new Set(allRecords.map((r) => r.callerIdNumber).filter((p): p is string => p !== null)),
      ),
    [allRecords],
  );
  const { data: dncMap } = useDncCheck(phoneList);

  // Filter options derived from data.
  const agentOptions = useMemo(
    () =>
      (stats?.by_extension ?? []).flatMap((e) =>
        e.extension === null ? [] : [{ value: e.extension, label: e.agentName || e.extension }],
      ),
    [stats],
  );
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRecords
            .map((r) => r.extension?.department?.name)
            .filter((n): n is string => n !== undefined),
        ),
      ),
    [allRecords],
  );

  const countFor = (key: SourceTabKey): number | undefined => {
    if (key === '') return globalStats?.total_calls;
    return globalStats?.by_source?.find((s) => s.source === key)?.total_calls;
  };

  const header = (
    <View className="gap-4 pb-2">
      <SourceTabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          // Campaign filter is telesales-only — drop it when leaving that tab.
          if (next !== 'telesales' && filters.campaignId) {
            setFilters((f) => ({ ...f, campaignId: undefined }));
          }
        }}
        countFor={countFor}
      />
      <StatsRow stats={stats} />
      <SearchFilterRow
        value={searchInput}
        onChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={countActive(filters)}
        placeholder="Search lead, number or agent…"
      />
    </View>
  );

  // Screen-level permission gate (mirrors web PermissionGate calls:read). All
  // hooks above run unconditionally; only the render branches on the verdict.
  if (perm !== 'allowed') {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {perm === 'denied' ? (
          <EmptyState
            icon="Lock"
            title="No access"
            description="You don't have permission to view call logs."
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Text className="text-2xl font-semibold text-foreground">Call Logs</Text>
        <Pressable
          disabled={exporting || records.length === 0}
          onPress={() => exportCsv(records, new Date().toISOString())}
          hitSlop={8}
          className="flex-row items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5"
          style={{ opacity: exporting || records.length === 0 ? 0.5 : 1 }}
        >
          <Icon name="Download" size={16} color={exportIconColor} />
          <Text className="text-sm font-medium text-primary-foreground">Export</Text>
        </Pressable>
      </View>

      <CallList
        records={records}
        total={total}
        isLoading={recordsQuery.isLoading}
        isError={recordsQuery.isError}
        isRefetching={recordsQuery.isRefetching}
        isFetchingNextPage={recordsQuery.isFetchingNextPage}
        dncMap={dncMap}
        player={player}
        ListHeaderComponent={header}
        onEndReached={() => {
          if (recordsQuery.hasNextPage && !recordsQuery.isFetchingNextPage) {
            recordsQuery.fetchNextPage().catch(() => {});
          }
        }}
        onRefresh={() => {
          recordsQuery.refetch().catch(() => {});
        }}
        onSelect={(record) => router.push(`/calls/${record.uuid}`)}
        extraBottomSpace={canDial ? DIALER_FAB_SPACE : 0}
      />

      <DialerFab />

      <CallFilterSheet
        visible={sheetVisible}
        initial={filters}
        agentOptions={agentOptions}
        departmentOptions={departmentOptions}
        campaignOptions={tab === 'telesales' ? campaignOptions : []}
        onClose={() => setSheetVisible(false)}
        onApply={setFilters}
      />
    </View>
  );
}
