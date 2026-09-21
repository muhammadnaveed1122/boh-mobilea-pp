import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { BackButton } from '@/components/atoms/BackButton';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';

import { useAgentPresence } from '../hooks/use-agent-presence';
import { useAgentsInfinite } from '../hooks/use-agents';
import type { Agent, AgentPresence } from '../types';
import { AgentRow } from './AgentRow';

/** Coerce the `tab` query param to a valid presence value, defaulting to 'online'. */
function parseTab(raw: string | string[] | undefined): AgentPresence {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'offline' ? 'offline' : 'online';
}

function ListSkeleton() {
  return (
    <View className="gap-4 px-4 pt-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3 w-1/2 rounded" />
            <Skeleton className="h-2.5 w-2/3 rounded" />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Online/Offline agents directory. Initial tab comes from `?tab=` (the
 * dashboard's Online/Offline Agents tiles deep-link here). Presence is kept
 * live via `useAgentPresence` — the `presence:changed` socket event is an
 * invalidation hint only, so the list always re-fetches from the server
 * rather than patching counts locally.
 */
export function AgentsScreen() {
  const insets = useSafeAreaInsets();
  const bottomSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  const [presence, setPresence] = useState<AgentPresence>(() => parseTab(tab));

  useAgentPresence();

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAgentsInfinite(presence);

  const agents = useMemo<Agent[]>(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(() => {});
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton />
        <Text className="text-2xl font-bold text-foreground">Agents</Text>
      </View>

      <View className="px-4 pb-3">
        <Tabs value={presence} onValueChange={(v) => setPresence(v as AgentPresence)}>
          <TabsList>
            <TabsTrigger value="online">
              <Text>Online</Text>
            </TabsTrigger>
            <TabsTrigger value="offline">
              <Text>Offline</Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </View>

      {isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AgentRow agent={item} />}
          contentContainerStyle={{ paddingBottom: bottomSpace, flexGrow: 1 }}
          onEndReachedThreshold={0.5}
          onEndReached={handleEndReached}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => refetch().catch(() => {})}
              tintColor={brand}
            />
          }
          ListEmptyComponent={
            isError ? (
              <EmptyState
                icon="Users"
                title="Couldn't load agents"
                description="Pull down to retry."
              />
            ) : (
              <EmptyState
                icon="Users"
                title={presence === 'online' ? 'No agents online' : 'No offline agents'}
              />
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-6">
                <ActivityIndicator color={brand} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
