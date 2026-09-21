import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { AreaListingCard } from '@/features/areas/components/AreaListingCard';
import type { AreaListingItem } from '@/features/areas/models/area-detail';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { cn } from '@/lib/utils';

import { useProjectsInfinite } from '../hooks/use-projects-infinite';
import type { ProjectListFilters } from '../services';
import { useCompareStore } from '../store/compare.store';
import { CompareBar } from './CompareBar';
import { ProjectFilters } from './ProjectFilters';

function ScreenHeader() {
  const { top } = useSafeAreaInsets();
  const brand = useThemeColor('--brand');
  const compareMode = useCompareStore((s) => s.compareMode);
  const setCompareMode = useCompareStore((s) => s.setCompareMode);
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ArrowLeft" size={24} />
        </Pressable>
        <Text className="flex-1 text-xl font-bold text-foreground">Project List</Text>
        <Pressable
          onPress={() => setCompareMode(!compareMode)}
          accessibilityRole="button"
          accessibilityState={{ selected: compareMode }}
          accessibilityLabel={compareMode ? 'Exit compare mode' : 'Compare projects'}
          hitSlop={8}
          className={cn(
            'h-9 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70',
            compareMode ? 'border-brand bg-brand/10' : 'border-border',
          )}
        >
          <Icon name="Scale" size={16} color={compareMode ? brand : undefined} />
          <Text
            className={cn('text-sm font-medium', compareMode ? 'text-brand' : 'text-foreground')}
          >
            {compareMode ? 'Done' : 'Compare'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ListEmpty({ isLoading, isError }: Readonly<{ isLoading: boolean; isError: boolean }>) {
  if (isLoading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View className="items-center px-8 pt-10">
        <EmptyState
          icon="CircleAlert"
          title="Couldn't load projects"
          description="Pull down to retry."
        />
      </View>
    );
  }
  return (
    <View className="items-center px-8 pt-10">
      <EmptyState
        icon="Building2"
        title="No projects found"
        description="Try adjusting your filters."
      />
    </View>
  );
}

export function ProjectListScreen() {
  const canAccess = useCan(PERMISSIONS.PROJECTS_READ);
  const [filters, setFilters] = React.useState<ProjectListFilters>({});
  const { bottom } = useSafeAreaInsets();

  const compareMode = useCompareStore((s) => s.compareMode);
  const selectedItems = useCompareStore((s) => s.items);
  const toggle = useCompareStore((s) => s.toggle);
  const selectedIds = React.useMemo(() => new Set(selectedItems.map((i) => i.id)), [selectedItems]);
  const barVisible = compareMode && selectedItems.length > 0;
  const bottomSpace = bottom + 16 + (barVisible ? 88 : 0);

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useProjectsInfinite(filters, { enabled: canAccess });

  const items: AreaListingItem[] = React.useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  if (!canAccess) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="ShieldOff"
            title="No access"
            description="You don't have permission to view Projects."
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{
          gap: 12,
          paddingTop: 12,
          paddingBottom: bottomSpace,
          paddingHorizontal: 16,
        }}
        ListHeaderComponent={
          <View className="pb-1">
            <ProjectFilters filters={filters} onChange={setFilters} />
          </View>
        }
        renderItem={({ item }) => (
          <AreaListingCard
            item={item}
            selectable={compareMode}
            selected={selectedIds.has(item.id)}
            onToggleSelect={() =>
              toggle({
                id: item.id,
                label: item.title,
                subLabel: item.area,
                imageUrl: item.imageUrls[0] ?? null,
              })
            }
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListEmptyComponent={<ListEmpty isLoading={isLoading} isError={isError} />}
        onRefresh={() => {
          refetch();
        }}
        refreshing={isRefetching}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="flex-row items-center justify-center gap-2 py-4">
              <ActivityIndicator />
              <Text className="text-sm text-muted-foreground">Loading more projects…</Text>
            </View>
          ) : null
        }
      />
      <CompareBar />
    </View>
  );
}
