// app/(tabs)/favourites.tsx
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { FavoriteListingCard } from '@/features/favorites/components/FavoriteListingCard';
import { FavoriteProjectCard } from '@/features/favorites/components/FavoriteProjectCard';
import {
  useFavoriteListingsList,
  useFavoriteProjectsList,
} from '@/features/favorites/hooks/use-favorites-list';
import type {
  ClientFavoriteListingItem,
  ClientFavoriteProjectItem,
} from '@/features/favorites/types';
import { useRole } from '@/lib/rbac';
import { useRefetchOnTabFocus } from '@/lib/tab-focus-refresh';
import { useThemeColor } from '@theme';
import { useAuthStore } from '@/store/auth.store';

type Row =
  | { type: 'project'; item: ClientFavoriteProjectItem }
  | { type: 'listing'; item: ClientFavoriteListingItem };

export default function FavouritesScreen() {
  const insets = useSafeAreaInsets();
  const mutedFg = useThemeColor('--muted-foreground');
  const { isPortalUser, isCustomer } = useRole();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const projects = useFavoriteProjectsList();
  const listings = useFavoriteListingsList();
  useRefetchOnTabFocus([projects, listings]);

  const projectRows = useMemo<Row[]>(
    () =>
      (projects.data?.pages.flatMap((p) => p.items) ?? []).map((item) => ({
        type: 'project' as const,
        item,
      })),
    [projects.data],
  );
  const listingRows = useMemo<Row[]>(
    () =>
      (listings.data?.pages.flatMap((p) => p.items) ?? []).map((item) => ({
        type: 'listing' as const,
        item,
      })),
    [listings.data],
  );

  const sections = useMemo(
    () =>
      [
        { title: 'Projects', data: projectRows },
        { title: 'Listings', data: listingRows },
      ].filter((s) => s.data.length > 0),
    [projectRows, listingRows],
  );

  const isLoading = projects.isLoading || listings.isLoading;
  const isError = !!projects.error || !!listings.error;

  if (!isAuthenticated) return <Redirect href="/" />;

  if (!isPortalUser && !isCustomer) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="muted" className="text-center">
            Sign in as a client to use favourites.
          </Text>
        </View>
      </View>
    );
  }

  function handleRefresh(): void {
    projects.refetch().catch(() => {});
    listings.refetch().catch(() => {});
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <SectionList<Row, { title: string; data: Row[] }>
        sections={sections}
        keyExtractor={(row) =>
          row.type === 'project' ? `p-${row.item.favoriteId}` : `l-${row.item.favoriteId}`
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-background px-4 pb-2 pt-3">
            <Text className="text-lg font-bold text-foreground">{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="px-4">
            {item.type === 'project' ? (
              <FavoriteProjectCard item={item.item} />
            ) : (
              <FavoriteListingCard item={item.item} />
            )}
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center px-6 py-24">
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <>
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Icon name={isError ? 'WifiOff' : 'Heart'} size={22} color={mutedFg} />
                </View>
                <Text className="text-center text-sm font-medium text-foreground">
                  {isError ? 'Could not load favourites' : 'No favourites yet'}
                </Text>
                <Text className="mt-1 text-center text-xs text-muted-foreground">
                  {isError ? 'Pull down to retry' : 'Tap the heart on a project to save it here'}
                </Text>
              </>
            )}
          </View>
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (projects.hasNextPage && !projects.isFetchingNextPage) {
            projects.fetchNextPage().catch(() => {});
          }
          if (listings.hasNextPage && !listings.isFetchingNextPage) {
            listings.fetchNextPage().catch(() => {});
          }
        }}
        ListFooterComponent={
          projects.isFetchingNextPage || listings.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={
              (projects.isFetching && !projects.isFetchingNextPage) ||
              (listings.isFetching && !listings.isFetchingNextPage)
            }
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
