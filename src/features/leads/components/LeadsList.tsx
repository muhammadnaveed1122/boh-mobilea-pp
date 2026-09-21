import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { useInvalidateFunnelStats } from '../hooks/use-funnel-stats';
import { useLeadsInfinite } from '../hooks/use-leads';
import { useSearchDebounceSync } from '../hooks/use-search-debounce';
import type { LeadListItem } from '../types';
import { LeadCard } from './LeadCard';
import { LeadFilterChips } from './LeadFilterChips';
import { LeadSearchBar } from './LeadSearchBar';
import { LeadStatTiles } from './LeadStatTiles';

type Row =
  | { kind: 'stats' }
  | { kind: 'sticky' }
  | { kind: 'error'; message: string }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'lead'; lead: LeadListItem };

const STICKY_INDEX = 1;

function keyExtractor(row: Row): string {
  switch (row.kind) {
    case 'stats':
      return '__stats__';
    case 'sticky':
      return '__sticky__';
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

function StickyHeader({ withBorder }: Readonly<{ withBorder: boolean }>) {
  return (
    <View className={`bg-background pb-3 pt-1 ${withBorder ? 'border-b border-border' : ''}`}>
      <LeadSearchBar />
      <LeadFilterChips />
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

function makeRowRenderer(brand: string, stickyBorder: boolean) {
  return function renderRow({ item }: { item: Row }) {
    switch (item.kind) {
      case 'stats':
        return (
          <View className="pb-3 pt-2">
            <LeadStatTiles />
          </View>
        );
      case 'sticky':
        return <StickyHeader withBorder={stickyBorder} />;
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
}

export function LeadsList() {
  useSearchDebounceSync();
  const insets = useSafeAreaInsets();
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
  } = useLeadsInfinite();

  const leads = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'stats' }, { kind: 'sticky' }];
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
  }, [leads, isError, error, isLoading]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(() => {
        /* error surfaced via isError */
      });
    }
  };

  const handleRefresh = () => {
    invalidateFunnelStats();
    refetch().catch(() => {
      /* error surfaced via isError */
    });
  };

  const listFooter = isFetchingNextPage ? (
    <View className="py-6">
      <ActivityIndicator color={brand} />
    </View>
  ) : null;

  return (
    <FlatList
      data={rows}
      keyExtractor={keyExtractor}
      renderItem={makeRowRenderer(brand, scrolled)}
      stickyHeaderIndices={[STICKY_INDEX]}
      ListFooterComponent={listFooter}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
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
