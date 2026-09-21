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
import { useThemeColor } from '@theme';
import { useAllLeadsInfinite, type AllLeadsParams } from '../hooks/use-all-leads';
import { useInvalidateFunnelStats } from '../hooks/use-funnel-stats';
import type { LeadListItem } from '../types';
import { LeadCard } from './LeadCard';
import { SearchFilterRow } from '@/components/molecules';
import { LeadsStatusPills, type StatusPillValue } from './LeadsStatusPills';

type Row =
  | { kind: 'sticky' }
  | { kind: 'count'; total: number }
  | { kind: 'error'; message: string }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'lead'; lead: LeadListItem };

const STICKY_INDEX = 0;

function keyExtractor(row: Row): string {
  switch (row.kind) {
    case 'sticky':
      return '__sticky__';
    case 'count':
      return '__count__';
    case 'error':
      return '__error__';
    case 'loading':
      return '__loading__';
    case 'empty':
      return '__empty__';
    case 'lead':
      return row.lead.id;
  }
}

interface StickyHeaderProps {
  withBorder: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  status: StatusPillValue;
  onStatusChange: (s: StatusPillValue) => void;
}

function StickyHeader({
  withBorder,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  status,
  onStatusChange,
}: Readonly<StickyHeaderProps>) {
  return (
    <View className={`bg-background pb-3 pt-1 ${withBorder ? 'border-b border-border' : ''}`}>
      <SearchFilterRow
        value={searchValue}
        onChange={onSearchChange}
        onOpenFilters={onOpenFilters}
        filterCount={filterCount}
        placeholder="Search by name, email or phone…"
      />
      <LeadsStatusPills value={status} onChange={onStatusChange} />
    </View>
  );
}

function ErrorRow({ message }: Readonly<{ message: string }>) {
  return (
    <View className="mx-4 mt-3 rounded-xl bg-destructive/10 px-3 py-2">
      <Text className="text-xs text-destructive">{message}</Text>
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

function LeadRow({ lead }: Readonly<{ lead: LeadListItem }>) {
  return (
    <View className="px-4 pb-3">
      <LeadCard lead={lead} />
    </View>
  );
}

function LoadingRow({ color }: Readonly<{ color: string }>) {
  return (
    <View className="items-center py-12">
      <ActivityIndicator color={color} />
    </View>
  );
}

function EmptyRow() {
  return (
    <View className="items-center px-4 py-12">
      <Text className="text-sm text-muted-foreground">No leads found.</Text>
    </View>
  );
}

export interface AllLeadsListProps {
  params: AllLeadsParams;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  status: StatusPillValue;
  onStatusChange: (s: StatusPillValue) => void;
}

export function AllLeadsList({
  params,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  status,
  onStatusChange,
}: Readonly<AllLeadsListProps>) {
  const tabBarSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');
  const invalidateFunnelStats = useInvalidateFunnelStats();
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled((prev) => {
      const next = y > 4;
      return prev === next ? prev : next;
    });
  }, []);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAllLeadsInfinite(params);

  const leads = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const total = data?.pages[0]?.total;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'sticky' }];
    if (typeof total === 'number') out.push({ kind: 'count', total });
    if (isError) {
      out.push({
        kind: 'error',
        message: error?.message ?? 'Failed to load leads. Pull to retry.',
      });
    }
    if (leads.length === 0) {
      out.push(isLoading ? { kind: 'loading' } : { kind: 'empty' });
    } else {
      for (const lead of leads) out.push({ kind: 'lead', lead });
    }
    return out;
  }, [leads, isError, error, isLoading, total]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(() => {});
    }
  };

  const handleRefresh = () => {
    invalidateFunnelStats();
    refetch().catch(() => {});
  };

  const listFooter = isFetchingNextPage ? (
    <View className="py-6">
      <ActivityIndicator color={brand} />
    </View>
  ) : null;

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
            status={status}
            onStatusChange={onStatusChange}
          />
        );
      case 'count':
        return <CountRow total={item.total} />;
      case 'error':
        return <ErrorRow message={item.message} />;
      case 'loading':
        return <LoadingRow color={brand} />;
      case 'empty':
        return <EmptyRow />;
      case 'lead':
        return <LeadRow lead={item.lead} />;
    }
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      stickyHeaderIndices={[STICKY_INDEX]}
      ListFooterComponent={listFooter}
      contentContainerStyle={{ paddingBottom: tabBarSpace + 80 }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onEndReachedThreshold={0.5}
      onEndReached={handleEndReached}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={handleRefresh}
          tintColor={brand}
        />
      }
    />
  );
}
