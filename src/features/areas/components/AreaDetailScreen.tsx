import * as React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { BackButton } from '@/components/atoms/BackButton';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';

import type { AreaDetailTab } from '../models/area-detail';
import { useAreaDetail } from '../hooks/use-area-detail';
import { AreaListingCard } from './AreaListingCard';

const TABS: { key: AreaDetailTab; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'sell', label: 'Sell' },
  { key: 'rent', label: 'Rent' },
];

function ListEmpty({
  isLoading,
  isError,
  label,
}: Readonly<{ isLoading: boolean; isError: boolean; label: string }>) {
  if (isLoading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 w-full rounded-2xl" />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View className="items-center px-8 pt-10">
        <EmptyState
          icon="CircleAlert"
          title="Couldn't load listings"
          description="Pull down to retry."
        />
      </View>
    );
  }
  return (
    <View className="items-center px-8 pt-10">
      <EmptyState
        icon="Inbox"
        title={`No ${label.toLowerCase()} listings`}
        description="Nothing to show for this area yet."
      />
    </View>
  );
}

export function AreaDetailScreen() {
  const canAccess = useCan(PERMISSIONS.AREAS_READ);
  const { top, bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; city?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const name = params.name ?? 'Area';
  const city = params.city ?? '';

  const {
    tab,
    setTab,
    items,
    counts,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAreaDetail(id, { enabled: canAccess });

  const activeLabel = TABS.find((t) => t.key === tab)?.label ?? '';

  if (!canAccess) {
    return (
      <View style={{ paddingTop: top }} className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <BackButton />
          <Text className="text-xl font-bold text-foreground">Area</Text>
        </View>
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
      <View style={{ paddingTop: top }} className="bg-background">
        <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
          <BackButton />
          <View className="flex-1">
            <Text numberOfLines={1} className="text-xl font-bold text-foreground">
              {name}
            </Text>
            {city ? <Text className="text-xs text-muted-foreground">{city}</Text> : null}
          </View>
        </View>

        <View className="px-4 pb-3 pt-1">
          <Tabs value={tab} onValueChange={(v) => setTab(v as AreaDetailTab)}>
            <TabsList>
              {TABS.map((t) => {
                const c = counts[t.key];
                return (
                  <TabsTrigger key={t.key} value={t.key}>
                    <Text>
                      {t.label}
                      {c > 0 ? ` (${c})` : ''}
                    </Text>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => `${tab}:${it.id}`}
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: bottom + 16,
        }}
        renderItem={({ item }) => <AreaListingCard item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListEmptyComponent={
          <ListEmpty isLoading={isLoading} isError={isError} label={activeLabel} />
        }
        onRefresh={refetch}
        refreshing={isRefetching}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="flex-row items-center justify-center gap-2 py-4">
              <ActivityIndicator />
              <Text className="text-sm text-muted-foreground">Loading more…</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
