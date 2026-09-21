import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';

import type { AreasFilters } from '../hooks/use-neighbourhoods-infinite';
import type { Area } from '../models/area';
import { useNeighbourhoodsInfinite } from '../hooks/use-neighbourhoods-infinite';
import { AreaCard } from './AreaCard';
import { AreaFilters } from './AreaFilters';

function ScreenHeader() {
  const { top } = useSafeAreaInsets();
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
        <Text className="text-xl font-bold text-foreground">Areas</Text>
      </View>
    </View>
  );
}

function ListEmpty({ isLoading, isError }: Readonly<{ isLoading: boolean; isError: boolean }>) {
  if (isLoading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View className="items-center px-8 pt-10">
        {/* EmptyState atom has no actionLabel/onAction — pull-to-refresh handles retry. */}
        <EmptyState
          icon="CircleAlert"
          title="Couldn't load areas"
          description="Pull down to retry."
        />
      </View>
    );
  }
  return (
    <View className="items-center px-8 pt-10">
      <EmptyState icon="MapPin" title="No areas found" description="Try adjusting your filters." />
    </View>
  );
}

export function AreasScreen() {
  const canAccess = useCan(PERMISSIONS.AREAS_READ);
  const [filters, setFilters] = React.useState<AreasFilters>({});
  const { bottom } = useSafeAreaInsets();
  const bottomSpace = bottom + 16;

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useNeighbourhoodsInfinite(filters, { enabled: canAccess });

  const items: Area[] = React.useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  if (!canAccess) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="ShieldOff"
            title="No access"
            description="You don't have permission to view Areas."
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
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <View className="px-4 pb-1">
            <AreaFilters filters={filters} onChange={setFilters} />
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <AreaCard area={item} />
          </View>
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
              <Text className="text-sm text-muted-foreground">Loading more areas…</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
