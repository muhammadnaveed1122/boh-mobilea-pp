import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { MAIN_HEADER_HEIGHT } from '@/components/organisms';
import { useThemeColor } from '@theme';
import { AttendanceWidget } from '@/features/attendance';
import { RecentListingsSection } from '@/features/listings/components/RecentListingsSection';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { LeadsHomeStatTiles } from './LeadsHomeStatTiles';
import { RecentLeadsSection } from './RecentLeadsSection';

function HomeSearchBar() {
  const muted = useThemeColor('--muted-foreground');
  return (
    <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-full border border-border bg-card px-4">
      <Icon name="Search" size={16} color={muted} />
      <Input
        placeholder="Search by leads, listings, properties..."
        className="h-11 flex-1 border-0 bg-transparent px-0 text-sm"
      />
    </View>
  );
}

export function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useBottomTabBarSpace();
  const qc = useQueryClient();
  const brand = useThemeColor('--brand');
  const canReadLeads = useCan([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  const canReadListings = useCan(PERMISSIONS.OPPORTUNITY_LISTING_READ);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    qc.invalidateQueries()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [qc]);

  useFocusEffect(
    useCallback(() => {
      if (!canReadLeads) return;
      qc.invalidateQueries({ queryKey: ['leads'] }).catch(() => {});
    }, [qc, canReadLeads]),
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + MAIN_HEADER_HEIGHT }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={brand}
            colors={[brand]}
          />
        }
      >
        <HomeSearchBar />
        <LeadsHomeStatTiles canReadLeads={canReadLeads} canReadListings={canReadListings} />
        <View className="mx-4 mt-6">
          <AttendanceWidget />
        </View>
        {canReadLeads ? (
          <View className="mt-6">
            <RecentLeadsSection onViewAll={() => router.push('/leads/all')} />
          </View>
        ) : null}
        {canReadListings ? (
          <View className="mt-4">
            <RecentListingsSection onViewAll={() => router.push('/listings')} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
