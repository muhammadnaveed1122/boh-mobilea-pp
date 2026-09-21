import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { EmptyState } from '@/components/atoms/EmptyState';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';
import type { ListingStage, ListingsLifecycle, UnifiedListingRow } from '../types';
import { ListingsLifecycleTabs } from './ListingsLifecycleTabs';
import { SearchFilterRow } from '@/components/molecules';
import { ListingsStagePills } from './ListingsStagePills';
import { UnifiedListingCard } from './UnifiedListingCard';
import { compareKey, useListingCompareStore } from '../store/compare.store';

type Row =
  | { kind: 'sticky' }
  | { kind: 'loading' }
  | { kind: 'empty'; isError: boolean }
  | { kind: 'listing'; row: UnifiedListingRow };

const STICKY_INDEX = 0;

function keyExtractor(row: Row): string {
  switch (row.kind) {
    case 'sticky':
      return '__sticky__';
    case 'loading':
      return '__loading__';
    case 'empty':
      return '__empty__';
    case 'listing':
      return `${row.row.kind}:${row.row.id}`;
  }
}

interface StickyHeaderProps {
  withBorder: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  lifecycle: ListingsLifecycle;
  onLifecycleChange: (l: ListingsLifecycle) => void;
  soldLabel: string;
  stages: ListingStage[];
  stageCounts: Record<string, number>;
  stageId: string | undefined;
  onStageChange: (stageId: string | undefined) => void;
}

function StickyHeaderBase({
  withBorder,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  lifecycle,
  onLifecycleChange,
  soldLabel,
  stages,
  stageCounts,
  stageId,
  onStageChange,
}: Readonly<StickyHeaderProps>) {
  return (
    <View className={`bg-background pb-2 ${withBorder ? 'border-b border-border' : ''}`}>
      <ListingsLifecycleTabs value={lifecycle} onChange={onLifecycleChange} soldLabel={soldLabel} />
      <View className="mt-2">
        <SearchFilterRow
          value={searchValue}
          onChange={onSearchChange}
          onOpenFilters={onOpenFilters}
          filterCount={filterCount}
          placeholder="Search listings by name…"
        />
      </View>
      <ListingsStagePills
        stages={stages}
        stageCounts={stageCounts}
        value={stageId}
        onChange={onStageChange}
      />
    </View>
  );
}

const StickyHeader = memo(StickyHeaderBase);

/**
 * One virtualized row. Memoized and self-contained (no inline closures from the
 * parent) so a scroll tick or a search keystroke does not re-render every card.
 */
const ListingRow = memo(function ListingRow({
  row,
  stages,
  selectable,
  selected,
  onToggle,
}: Readonly<{
  row: UnifiedListingRow;
  stages: ListingStage[];
  selectable: boolean;
  selected: boolean;
  onToggle: (row: UnifiedListingRow) => void;
}>) {
  const handleToggle = useCallback(() => onToggle(row), [onToggle, row]);
  return (
    <View className="px-4 pb-3">
      <UnifiedListingCard
        row={row}
        stages={stages}
        selectable={selectable}
        selected={selected}
        onToggleSelect={handleToggle}
      />
    </View>
  );
});

function EmptyRow({ isError }: Readonly<{ isError: boolean }>) {
  return (
    <EmptyState
      icon="Building2"
      title={isError ? 'Could not load listings' : 'No listings found'}
      description={
        isError ? 'Pull down to refresh.' : 'Try adjusting your search, tabs, or filters.'
      }
    />
  );
}

export interface UnifiedListingsListProps {
  rows: UnifiedListingRow[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  lifecycle: ListingsLifecycle;
  onLifecycleChange: (l: ListingsLifecycle) => void;
  soldLabel: string;
  stages: ListingStage[];
  stageCounts: Record<string, number>;
  stageId: string | undefined;
  onStageChange: (stageId: string | undefined) => void;
}

export function UnifiedListingsList({
  rows,
  isLoading,
  isError,
  isRefetching,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onRefresh,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  lifecycle,
  onLifecycleChange,
  soldLabel,
  stages,
  stageCounts,
  stageId,
  onStageChange,
}: Readonly<UnifiedListingsListProps>) {
  const tabBarSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');
  const [scrolled, setScrolled] = useState(false);

  const compareMode = useListingCompareStore((s) => s.compareMode);
  const selectedItems = useListingCompareStore((s) => s.items);
  const toggle = useListingCompareStore((s) => s.toggle);
  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((i) => compareKey(i))),
    [selectedItems],
  );
  const barVisible = compareMode && selectedItems.length > 0;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled((prev) => {
      const next = y > 4;
      return prev === next ? prev : next;
    });
  }, []);

  const listRows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'sticky' }];
    if (rows.length === 0) {
      if (isLoading) out.push({ kind: 'loading' });
      else out.push({ kind: 'empty', isError });
    } else {
      for (const row of rows) out.push({ kind: 'listing', row });
    }
    return out;
  }, [rows, isLoading, isError]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) onLoadMore();
  };

  const listFooter = isFetchingNextPage ? (
    <View className="py-6">
      <ActivityIndicator color={brand} />
    </View>
  ) : null;

  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: tabBarSpace + 80 + (barVisible ? 88 : 0) }),
    [tabBarSpace, barVisible],
  );

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'sticky':
        return (
          <StickyHeader
            withBorder={scrolled}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            onOpenFilters={onOpenFilters}
            filterCount={filterCount}
            lifecycle={lifecycle}
            onLifecycleChange={onLifecycleChange}
            soldLabel={soldLabel}
            stages={stages}
            stageCounts={stageCounts}
            stageId={stageId}
            onStageChange={onStageChange}
          />
        );
      case 'loading':
        return (
          <View className="items-center py-12">
            <ActivityIndicator color={brand} />
          </View>
        );
      case 'empty':
        return <EmptyRow isError={item.isError} />;
      case 'listing':
        return (
          <ListingRow
            row={item.row}
            stages={stages}
            selectable={compareMode}
            selected={selectedKeys.has(compareKey(item.row))}
            onToggle={toggle}
          />
        );
    }
  };

  return (
    <FlatList
      data={listRows}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      stickyHeaderIndices={[STICKY_INDEX]}
      ListFooterComponent={listFooter}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onEndReachedThreshold={0.5}
      onEndReached={handleEndReached}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={60}
      windowSize={7}
      removeClippedSubviews
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={onRefresh}
          tintColor={brand}
        />
      }
    />
  );
}
