import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { SearchFilterRow } from '@/components/molecules';
import { useDebouncedValue } from '@/features/new-projects/hooks/use-debounced-value';
import { useThemeColor } from '@theme';
import { LIST_PAGE_SIZE } from '../constants';
import { usePropertiesFeed } from '../hooks/use-properties-feed';
import type { ListingType } from '../services';
import type { PropertyCard as PropertyCardModel } from '../types';
import { countActiveBuyFilters, filterBuyCards, type BuyFilters } from '../utils/filter-buy';
import { BuyFiltersSheet } from './BuyFiltersSheet';
import { PropertyCard } from './PropertyCard';

function EmptyState({ state }: Readonly<{ state: 'loading' | 'error' | 'empty' }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  if (state === 'loading') {
    return (
      <View className="items-center py-20">
        <ActivityIndicator />
      </View>
    );
  }
  const icon = state === 'error' ? 'WifiOff' : 'SearchX';
  const title =
    state === 'error' ? 'Could not load properties' : 'No properties match your filters';
  const hint = state === 'error' ? 'Pull down to retry' : 'Try clearing some filters';
  return (
    <View className="items-center px-6 py-20">
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon name={icon} size={22} color={mutedFg} />
      </View>
      <Text className="text-center text-sm font-medium text-foreground">{title}</Text>
      <Text className="mt-1 text-center text-xs text-muted-foreground">{hint}</Text>
    </View>
  );
}

export function PropertyListing({
  listingType = 'buy',
  contentBottomPadding = 24,
}: Readonly<{ listingType?: ListingType; contentBottomPadding?: number }>) {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<BuyFilters>({ status: 'all' });
  const [sheetVisible, setSheetVisible] = useState(false);
  const [visible, setVisible] = useState(LIST_PAGE_SIZE);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  const { data, isLoading, isFetching, refetch, error } = usePropertiesFeed(listingType);
  const isRent = listingType === 'rent';

  const effectiveFilters = useMemo<BuyFilters>(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const filtered = useMemo(
    () => filterBuyCards(data ?? [], effectiveFilters),
    [data, effectiveFilters],
  );

  // Reset the lazy window whenever the result set changes.
  useEffect(() => {
    setVisible(LIST_PAGE_SIZE);
  }, [effectiveFilters]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const filterCount = countActiveBuyFilters(filters);

  let emptyState: 'loading' | 'error' | 'empty' = 'empty';
  if (isLoading) emptyState = 'loading';
  else if (error) emptyState = 'error';

  // Kept to a single compact band: every point spent here is a point of list
  // viewport lost, and the result count doesn't warrant a row of its own.
  const stickyHeader = (
    <View className="bg-background pb-1.5">
      <SearchFilterRow
        value={searchInput}
        onChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={filterCount}
        placeholder="Search properties, locations…"
      />
      {!isLoading && !error ? (
        <View className="mt-1.5 px-4">
          <Text className="text-[11px] text-muted-foreground">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? 'property' : 'properties'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const sections: { data: PropertyCardModel[] }[] = [{ data: shown }];

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pb-3">
            <PropertyCard card={item} isRent={isRent} />
          </View>
        )}
        renderSectionHeader={() => stickyHeader}
        stickySectionHeadersEnabled
        ListEmptyComponent={<EmptyState state={emptyState} />}
        ListFooterComponent={
          hasMore ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: contentBottomPadding }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMore) setVisible((v) => v + LIST_PAGE_SIZE);
        }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      />

      <BuyFiltersSheet
        visible={sheetVisible}
        initialFilters={filters}
        onClose={() => setSheetVisible(false)}
        onApply={(next) => setFilters(next)}
      />
    </>
  );
}
