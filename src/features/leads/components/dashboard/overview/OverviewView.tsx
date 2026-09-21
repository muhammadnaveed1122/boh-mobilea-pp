/**
 * The leads tab body: dashboard header (KPIs + categories) followed by the
 * paginated leads feed.
 *
 * One FlatList owns the whole screen rather than a ScrollView wrapping a list —
 * nesting them would break virtualisation and give the screen two competing
 * scrollers. The dashboard is just row 0; row 1 is the filter toolbar, pinned
 * with `stickyHeaderIndices` so search and status stay reachable once the user
 * is deep in the list.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Text } from '@/components/atoms/Text';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useAllLeadsInfinite } from '@/features/leads/hooks/use-all-leads';
import { useLeadsOverview } from '@/features/leads/hooks/use-leads-overview';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useRefetchOnTabFocus } from '@/lib/tab-focus-refresh';
import { useThemeColor } from '@theme';

import {
  buildLeadsQuery,
  clearAllFilters,
  countActiveFilters,
  removeFilter,
  type FilterKey,
  type LeadsFilterState,
} from '../../../models/leads-filters';
import type { LeadListItem, LeadsOverview } from '../../../types';
import { LeadsFilterSheet } from '../../filters/LeadsFilterSheet';
import { AssignAgentSheet } from '../../browse/AssignAgentSheet';
import { LeadActionSheet } from '../../browse/LeadActionSheet';
import { MoveStageSheet } from '../../browse/MoveStageSheet';
import { LeadCard } from '../../LeadCard';
import type { StatusPillValue } from '../../LeadsStatusPills';
import { CategoryCardsGrid } from '../CategoryCardsGrid';
import { KpiRail } from '../KpiRail';
import { LeadsFeedToolbar } from './LeadsFeedToolbar';

// Clearance for the floating "create lead" FAB (56px) + breathing room.
const FAB_CLEARANCE = 80;

/** The toolbar's fixed position in `rows` — what `stickyHeaderIndices` pins. */
const TOOLBAR_INDEX = 1;

type Row =
  | { kind: 'dashboard' }
  | { kind: 'toolbar' }
  | { kind: 'count'; total: number }
  | { kind: 'error'; message: string }
  | { kind: 'loading' }
  | { kind: 'empty'; filtered: boolean }
  | { kind: 'lead'; lead: LeadListItem };

function keyExtractor(row: Row): string {
  return row.kind === 'lead' ? row.lead.id : `__${row.kind}__`;
}

function DashboardHeader({
  data,
  isLoading,
  isError,
  onRetry,
}: Readonly<{
  data: LeadsOverview | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}>) {
  if (isError && !data) {
    return (
      <View className="items-center px-4 py-8">
        <Text className="text-sm text-muted-foreground" onPress={onRetry}>
          Couldn&apos;t load your stats. Tap to retry.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="mb-2 mt-1 px-4 text-sm font-extrabold text-foreground">Performance</Text>
      <KpiRail kpis={data?.kpis ?? []} loading={isLoading} />
      {data ? (
        <View className="mt-5">
          <CategoryCardsGrid tabCounts={data.tabCounts} />
        </View>
      ) : null}
      <Text className="mb-1 mt-6 px-4 text-sm font-extrabold text-foreground">All Leads</Text>
    </View>
  );
}

function CountRow({ total }: Readonly<{ total: number }>) {
  return (
    <View className="px-4 pt-3">
      <Text className="text-xs text-muted-foreground">
        {total.toLocaleString()} {total === 1 ? 'lead' : 'leads'}
      </Text>
    </View>
  );
}

function EmptyRow({ filtered }: Readonly<{ filtered: boolean }>) {
  return (
    <View className="items-center px-8 py-14">
      <Text className="text-sm font-semibold text-foreground">No leads found</Text>
      <Text className="mt-1 text-center text-xs text-muted-foreground">
        {filtered
          ? 'Nothing matches these filters. Clear one to widen the search.'
          : 'New leads will show up here as they come in.'}
      </Text>
    </View>
  );
}

export function OverviewView() {
  const overviewQuery = useLeadsOverview();
  const tabBarSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');

  const [filters, setFilters] = useState<LeadsFilterState>({});
  const [searchInput, setSearchInput] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const filterCount = countActiveFilters(filters);

  const params = useMemo(
    () => buildLeadsQuery({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const leadsQuery = useAllLeadsInfinite(params);
  useRefetchOnTabFocus([overviewQuery, leadsQuery]);

  const {
    data: leadsData,
    isLoading: leadsLoading,
    isError: leadsError,
    error,
    refetch: refetchLeads,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = leadsQuery;

  const leads = useMemo(() => leadsData?.pages.flatMap((p) => p.items) ?? [], [leadsData]);
  const total = leadsData?.pages[0]?.total;
  const isFiltered = filterCount > 0 || debouncedSearch.length > 0 || filters.status !== undefined;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'dashboard' }, { kind: 'toolbar' }];
    if (typeof total === 'number') out.push({ kind: 'count', total });
    if (leadsError) {
      out.push({
        kind: 'error',
        message: error?.message ?? 'Failed to load leads. Pull to retry.',
      });
    }
    if (leads.length === 0) {
      out.push(leadsLoading ? { kind: 'loading' } : { kind: 'empty', filtered: isFiltered });
    } else {
      for (const lead of leads) out.push({ kind: 'lead', lead });
    }
    return out;
  }, [leads, leadsError, error, leadsLoading, total, isFiltered]);

  // Card kebab targets. Same trio the category browse screens use, so a lead offers the
  // same actions wherever its card appears. `moveLead` holds the whole lead, not an id —
  // the stage sheet needs the current stage to preselect it and refuse a no-op change.
  const [actionLead, setActionLead] = useState<LeadListItem | null>(null);
  const [moveLead, setMoveLead] = useState<LeadListItem | null>(null);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > 4;
    setScrolled((prev) => (prev === past ? prev : past));
  }, []);

  const handleEndReached = (): void => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(() => {});
    }
  };

  const handleRefresh = (): void => {
    overviewQuery.refetch().catch(() => {});
    refetchLeads().catch(() => {});
  };

  const handleStatusChange = (status: StatusPillValue): void => {
    setFilters((prev) => ({
      ...prev,
      status: status === 'All' ? undefined : status,
    }));
  };

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'dashboard':
        return (
          <DashboardHeader
            data={overviewQuery.data}
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
            onRetry={() => overviewQuery.refetch()}
          />
        );
      case 'toolbar':
        return (
          <LeadsFeedToolbar
            withBorder={scrolled}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            onOpenFilters={() => setSheetVisible(true)}
            filterCount={filterCount}
            filters={filters}
            onStatusChange={handleStatusChange}
            onRemoveFilter={(key: FilterKey) => setFilters((prev) => removeFilter(prev, key))}
            onClearFilters={() => setFilters((prev) => clearAllFilters(prev))}
          />
        );
      case 'count':
        return <CountRow total={item.total} />;
      case 'error':
        return (
          <View className="mx-4 mt-3 rounded-xl bg-destructive/10 px-3 py-2">
            <Text className="text-xs text-destructive">{item.message}</Text>
          </View>
        );
      case 'loading':
        return (
          <View className="items-center py-12">
            <ActivityIndicator color={brand} />
          </View>
        );
      case 'empty':
        return <EmptyRow filtered={item.filtered} />;
      case 'lead':
        return (
          <View className="px-4 pb-3">
            <LeadCard lead={item.lead} onKebab={setActionLead} />
          </View>
        );
    }
  };

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        stickyHeaderIndices={[TOOLBAR_INDEX]}
        contentContainerStyle={{ paddingBottom: tabBarSpace + FAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.5}
        onEndReached={handleEndReached}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={brand} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={(isRefetching && !isFetchingNextPage) || overviewQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={brand}
          />
        }
      />
      <LeadsFilterSheet
        visible={sheetVisible}
        filters={filters}
        onApply={setFilters}
        onClose={() => setSheetVisible(false)}
      />
      <LeadActionSheet
        lead={actionLead}
        visible={!!actionLead}
        onClose={() => setActionLead(null)}
        onMoveStage={(l) => {
          setActionLead(null);
          setMoveLead(l);
        }}
        onAssign={(l) => {
          setActionLead(null);
          setAssignLeadId(l.id);
        }}
      />
      <MoveStageSheet
        leadId={moveLead?.id ?? null}
        currentStatus={moveLead?.status ?? null}
        visible={!!moveLead}
        onClose={() => setMoveLead(null)}
      />
      <AssignAgentSheet
        leadId={assignLeadId}
        visible={!!assignLeadId}
        onClose={() => setAssignLeadId(null)}
      />
    </>
  );
}
