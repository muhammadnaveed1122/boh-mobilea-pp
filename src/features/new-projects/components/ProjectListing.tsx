import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { SearchFilterRow } from '@/components/molecules';
import { useThemeColor } from '@theme';
import { usePublicProjects } from '../hooks/use-public-projects';
import { useStates } from '../hooks/use-states';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import type { PublicProjectListItem, PublicProjectsFilters } from '../types';
import { FilterChipBar } from './FilterChipBar';
import { ProjectFiltersSheet } from './ProjectFiltersSheet';
import { ProjectListingCard } from './ProjectListingCard';

function countActiveFilters(f: PublicProjectsFilters): number {
  let n = 0;
  if (f.status && f.status !== 'all') n += 1;
  if (f.propertyType && f.propertyType !== 'all') n += 1;
  n += f.beds?.length ?? 0;
  n += f.baths?.length ?? 0;
  if (f.city && f.city !== 'all') n += 1;
  if (f.priceRange && f.priceRange !== 'all') n += 1;
  if (f.handover && f.handover !== 'all') n += 1;
  return n;
}

interface EmptyStateProps {
  state: 'loading' | 'error' | 'empty';
}

function EmptyState({ state }: Readonly<EmptyStateProps>) {
  const mutedFg = useThemeColor('--muted-foreground');
  if (state === 'loading') {
    return (
      <View className="items-center py-20">
        <ActivityIndicator />
      </View>
    );
  }
  const icon = state === 'error' ? 'WifiOff' : 'SearchX';
  const title = state === 'error' ? 'Could not load projects' : 'No projects match your filters';
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

interface Props {
  headerComponent?: React.ReactElement | null;
  contentBottomPadding?: number;
}

export function ProjectListing({ headerComponent, contentBottomPadding = 24 }: Readonly<Props>) {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<PublicProjectsFilters>({ status: 'all' });
  const [sheetVisible, setSheetVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 500);
  const { data: states = [] } = useStates();

  const effectiveFilters = useMemo<PublicProjectsFilters>(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    error,
  } = usePublicProjects(effectiveFilters);

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const totalCount = data?.pages[0]?.total;
  const filterCount = countActiveFilters(filters);

  const stickyHeader = (
    <View className="bg-background pb-2">
      <SearchFilterRow
        value={searchInput}
        onChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={filterCount}
        placeholder="Search projects, locations…"
      />
      <FilterChipBar filters={filters} states={states} onChange={setFilters} />
      {typeof totalCount === 'number' ? (
        <View className="mt-3 px-4">
          <Text className="text-xs text-muted-foreground">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'project' : 'projects'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  let emptyState: 'loading' | 'error' | 'empty' = 'empty';
  if (isLoading) emptyState = 'loading';
  else if (error) emptyState = 'error';

  const sections: { data: PublicProjectListItem[] }[] = [{ data: items }];

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(() => {});
    }
  };

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.projectId}
        renderItem={({ item }) => (
          <View className="px-4 pb-6">
            <ProjectListingCard project={item} />
          </View>
        )}
        renderSectionHeader={() => stickyHeader}
        stickySectionHeadersEnabled
        ListHeaderComponent={headerComponent ? <View>{headerComponent}</View> : null}
        ListEmptyComponent={<EmptyState state={emptyState} />}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: contentBottomPadding }}
        onEndReachedThreshold={0.5}
        onEndReached={handleEndReached}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      />

      <ProjectFiltersSheet
        visible={sheetVisible}
        initialFilters={filters}
        onClose={() => setSheetVisible(false)}
        onApply={(next) => setFilters(next)}
      />
    </>
  );
}
