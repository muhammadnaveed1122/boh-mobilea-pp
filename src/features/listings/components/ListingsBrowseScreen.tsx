import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useThemeColor } from '@theme';
import {
  countActiveFilters,
  propertyTypeOptionsFromRows,
  useSellListings,
  type UnifiedFilterDraft,
} from '../hooks/use-sell-listings';
import { useListingStages } from '../hooks/use-listing-stages';
import type { ListingsLifecycle, ListingsPurpose } from '../types';
import { useListingCompareStore } from '../store/compare.store';
import { ListingCompareBar } from './ListingCompareBar';
import { UnifiedListingsFiltersSheet } from './UnifiedListingsFiltersSheet';
import { UnifiedListingsList } from './UnifiedListingsList';

/** Count badge + Compare toggle — shared by the standalone header and the tabbed title row. */
export function ListingsCountCompare({ total }: Readonly<{ total: number }>) {
  const brand = useThemeColor('--brand');
  const compareMode = useListingCompareStore((s) => s.compareMode);
  const setCompareMode = useListingCompareStore((s) => s.setCompareMode);
  return (
    <View className="flex-row items-center gap-2">
      {total > 0 ? (
        <View className="rounded-full bg-brand px-2.5 py-0.5">
          <Text className="text-xs font-bold text-brand-foreground">{total.toLocaleString()}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => setCompareMode(!compareMode)}
        accessibilityRole="button"
        accessibilityState={{ selected: compareMode }}
        accessibilityLabel={compareMode ? 'Exit compare mode' : 'Compare listings'}
        hitSlop={8}
        className={cn(
          'h-9 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70',
          compareMode ? 'border-brand bg-brand/10' : 'border-border',
        )}
      >
        <Icon name="Scale" size={16} color={compareMode ? brand : undefined} />
        <Text className={cn('text-sm font-medium', compareMode ? 'text-brand' : 'text-foreground')}>
          {compareMode ? 'Done' : 'Compare'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Shared listings browser for both the Sell and Rent pages — only `purpose` differs.
 * `embedded` renders it inside a parent that already owns the top chrome (tabbed
 * Listings screen): drops the safe-area padding and the whole header row (back
 * button, eyebrow, title, count badge, Compare). The parent hoists the count via
 * `onTotalChange` and renders the count + Compare in its own title row.
 */
export function ListingsBrowseScreen({
  purpose,
  embedded = false,
  onTotalChange,
  dateFrom,
  dateTo,
}: Readonly<{
  purpose: ListingsPurpose;
  embedded?: boolean;
  onTotalChange?: (total: number) => void;
  /** Inclusive ISO (`YYYY-MM-DD`) creation-date window, from the route. */
  dateFrom?: string;
  dateTo?: string;
}>) {
  const insets = useSafeAreaInsets();

  const [lifecycle, setLifecycle] = useState<ListingsLifecycle>('active');
  const [stageId, setStageId] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<UnifiedFilterDraft>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const filterCount = countActiveFilters(filters);

  // Stages are scoped per lifecycle — changing lifecycle resets the selected stage.
  const { data: stages } = useListingStages({ domain: 'listing', purpose, lifecycle });

  const onLifecycleChange = (next: ListingsLifecycle) => {
    setLifecycle(next);
    setStageId(undefined);
  };

  const state = useSellListings({
    purpose,
    lifecycle,
    // Unified feed: both data sources are always merged (no market toggle).
    market: 'all',
    search: debouncedSearch,
    filters,
    stageId,
    dateFrom,
    dateTo,
  });

  const propertyTypeOptions = useMemo(() => propertyTypeOptionsFromRows(state.rows), [state.rows]);

  // Embedded mode hoists the count up to the parent title row.
  useEffect(() => {
    onTotalChange?.(state.total);
  }, [state.total, onTotalChange]);

  const eyebrow = purpose === 'rent' ? 'For Rent' : 'For Sale';
  const soldLabel = purpose === 'rent' ? 'Rented' : 'Sold';

  return (
    <View
      className="flex-1 bg-background"
      style={embedded ? undefined : { paddingTop: insets.top }}
    >
      {embedded ? null : (
        <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
          <BackButton />
          <View className="flex-1">
            <Text className="text-[11px] font-semibold uppercase tracking-[2px] text-brand/70">
              {eyebrow}
            </Text>
            <Text className="text-xl font-bold leading-tight text-foreground">Listings</Text>
          </View>
          <ListingsCountCompare total={state.total} />
        </View>
      )}

      <UnifiedListingsList
        rows={state.rows}
        total={state.total}
        isLoading={state.isLoading}
        isError={state.isError}
        isRefetching={state.isRefetching}
        isFetchingNextPage={state.isFetchingNextPage}
        hasNextPage={state.hasNextPage}
        onLoadMore={state.loadMore}
        onRefresh={state.refetch}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={filterCount}
        lifecycle={lifecycle}
        onLifecycleChange={onLifecycleChange}
        soldLabel={soldLabel}
        stages={stages}
        stageCounts={state.stageCounts}
        stageId={stageId}
        onStageChange={setStageId}
      />

      <UnifiedListingsFiltersSheet
        visible={sheetVisible}
        initial={filters}
        propertyTypeOptions={propertyTypeOptions}
        onClose={() => setSheetVisible(false)}
        onApply={setFilters}
      />
      <ListingCompareBar />
    </View>
  );
}
