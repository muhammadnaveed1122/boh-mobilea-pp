import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { useLeadActivity } from '../../hooks/use-lead-activity';
import type { LeadActivity } from '../../models/lead-activity';

import {
  ActivityFiltersSheet,
  activityFilterCount,
  EMPTY_ACTIVITY_FILTER,
  type ActivityFilterDraft,
} from './ActivityFiltersSheet';
import { ActivityItem } from './ActivityItem';
import { groupActivitiesByDate } from './group-activities-by-date';

const SKELETON_KEYS: readonly string[] = ['s1', 's2', 's3'];

interface SkeletonRowProps {
  last: boolean;
}

function SkeletonRow({ last }: Readonly<SkeletonRowProps>) {
  return (
    <View className="flex-row">
      <View className="w-9 items-center">
        <View className="h-9 w-9 rounded-full bg-muted" />
        {last ? null : <View className="mt-1 w-0.5 flex-1 bg-border" />}
      </View>
      <View className="ml-3 flex-1 pb-5">
        <View className="h-4 w-1/2 rounded bg-muted" />
        <View className="mt-2 h-3 w-3/4 rounded bg-muted" />
        <View className="mt-2 h-3 w-1/4 rounded bg-muted" />
      </View>
    </View>
  );
}

interface SearchRowProps {
  value: string;
  onChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
}

/** Search field + filter button — mirrors the Listings screen search row. */
function SearchRow({ value, onChange, onOpenFilters, filterCount }: Readonly<SearchRowProps>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const brandFg = useThemeColor('--brand-foreground');
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-background px-4">
        <Icon name="Search" size={16} color={mutedFg} />
        <Input
          value={value}
          onChangeText={onChange}
          placeholder="Search activity…"
          className="h-11 flex-1 border-0 bg-transparent px-0 text-sm"
          returnKeyType="search"
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear search">
            <Icon name="X" size={14} color={mutedFg} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onOpenFilters}
        className="relative h-11 w-11 items-center justify-center rounded-full bg-brand active:opacity-80"
        accessibilityLabel="Filter activity"
      >
        <Icon name="SlidersHorizontal" size={16} color={brandFg} />
        {filterCount > 0 ? (
          <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
            <Text className="text-[10px] font-bold text-white">{filterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export interface ActivityLogTabProps {
  leadId: string;
  /** Gates contact-field masking in lead/qualification field-change rows. */
  canViewContact: boolean;
}

/**
 * Activity Log tab content. Vertical timeline of `LeadActivity` entries with
 * a search bar + filter button (opening `ActivityFiltersSheet`), "Load more"
 * pagination, and skeleton / empty / error states.
 *
 * Mirrors web `ActivityTimelineSection`, adapted for mobile:
 *   - Free-text search + single-select activity-type filter (web parity; the
 *     filter lives in a bottom sheet instead of an inline chip row).
 *   - SKIPS the date-range filter (documented in QA spec — see task 11).
 *   - Per-action rich cards (web: `StatusChangedCard`, `MessageCard`, etc.)
 *     collapse into a single `<ActivityItem />` row.
 *
 * Note: this component renders inside the lead-detail screen's outer
 * `<ScrollView>`, so the timeline list is a plain `map()` (not a `FlatList`)
 * to avoid nested-scroll issues. Pagination is a "Load more" button.
 */
export function ActivityLogTab({ leadId, canViewContact }: Readonly<ActivityLogTabProps>) {
  const [filterDraft, setFilterDraft] = useState<ActivityFilterDraft>(EMPTY_ACTIVITY_FILTER);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const destructive = useThemeColor('--destructive');
  const mutedFg = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');

  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const filters = useMemo(
    () => ({
      ...(filterDraft.actions.length > 0 ? { action: filterDraft.actions } : {}),
      ...(filterDraft.dateFrom ? { dateFrom: filterDraft.dateFrom } : {}),
      ...(filterDraft.dateTo ? { dateTo: filterDraft.dateTo } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [filterDraft, debouncedSearch],
  );

  const query = useLeadActivity(leadId, filters);

  const activities: LeadActivity[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const groups = useMemo(() => groupActivitiesByDate(activities), [activities]);

  const handleLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage().catch(() => {
        // surfaced via `query.isError` / `query.error` already; nothing to do here
      });
    }
  }, [query]);

  const handleRetry = useCallback(() => {
    query.refetch().catch(() => {
      // surfaced via `query.isError`
    });
  }, [query]);

  const showEmpty = !query.isLoading && !query.isError && activities.length === 0;
  const showList = !query.isLoading && !query.isError && activities.length > 0;

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-card p-4">
      {/* Search + filter */}
      <View className="mb-4">
        <SearchRow
          value={search}
          onChange={setSearch}
          onOpenFilters={() => setFiltersOpen(true)}
          filterCount={activityFilterCount(filterDraft)}
        />
      </View>

      <ActivityFiltersSheet
        visible={filtersOpen}
        initial={filterDraft}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilterDraft}
      />

      {/* Initial loading: 3 skeleton rows */}
      {query.isLoading ? (
        <View>
          {SKELETON_KEYS.map((key, idx) => (
            <SkeletonRow key={key} last={idx === SKELETON_KEYS.length - 1} />
          ))}
        </View>
      ) : null}

      {/* Error state */}
      {query.isError && !query.isLoading ? (
        <View className="items-center py-6">
          <Icon name="CircleAlert" size={24} color={destructive} />
          <Text className="mt-2 text-sm text-destructive">
            {query.error?.message ?? 'Failed to load activity'}
          </Text>
          <Pressable
            onPress={handleRetry}
            className="mt-3 rounded-lg bg-brand px-4 py-2 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-brand-foreground">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Empty state */}
      {showEmpty ? (
        <View className="items-center py-8">
          <Icon name="Inbox" size={28} color={mutedFg} />
          <Text className="mt-2 text-sm text-muted-foreground">No activity yet</Text>
        </View>
      ) : null}

      {/* Timeline list */}
      {showList ? (
        <View className="gap-6">
          {groups.map((group) => (
            <View key={group.date}>
              {/* Date divider */}
              <View className="mb-4 flex-row items-center gap-3">
                <Text className="text-sm font-semibold text-foreground">{group.dateLabel}</Text>
                <View className="h-px flex-1 bg-border" />
              </View>
              {group.activities.map((activity, index) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  last={index === group.activities.length - 1}
                  canViewContact={canViewContact}
                />
              ))}
            </View>
          ))}

          {query.hasNextPage ? (
            <Pressable
              onPress={handleLoadMore}
              disabled={query.isFetchingNextPage}
              className="mt-2 flex-row items-center justify-center rounded-lg border border-border py-2 active:opacity-80"
            >
              {query.isFetchingNextPage ? (
                <ActivityIndicator size="small" color={brand} />
              ) : (
                <Text className="text-sm font-semibold text-brand">Load more</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
