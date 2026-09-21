import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppMainHeader } from '@/components/organisms';
import { AttendanceWidget } from '@/features/attendance';
import { RecentListingsSection } from '@/features/listings/components/RecentListingsSection';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { attendanceKeys } from '@/features/attendance/hooks/keys';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useInvalidateOnTabFocus } from '@/lib/tab-focus-refresh';
import { HomeStatTiles } from './HomeStatTiles';
import { LeadsInsightsSection } from './LeadsInsightsSection';

/**
 * Staff home tab. Attendance check-in up top, then a stat grid (total/new leads,
 * missed/answered calls) and today's lead priorities. Lead sections render only
 * when the user can read leads; each stat tile is independently permission-gated.
 */
export function HomeDashboardScreen() {
  const tabBarSpace = useBottomTabBarSpace();
  const canReadLeads = useCan([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  const canReadListings = useCan(PERMISSIONS.OPPORTUNITY_LISTING_READ);

  useInvalidateOnTabFocus([
    ['leads', 'overview'],
    ['leads', 'funnel-stats'],
    ['call-stats', 'global'],
    attendanceKeys.today(),
  ]);

  return (
    <View className="flex-1 bg-background">
      <AppMainHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarSpace + 24 }}
      >
        <View className="mt-4 px-4">
          <AttendanceWidget />
        </View>
        <HomeStatTiles />
        {canReadLeads ? <LeadsInsightsSection /> : null}
        {canReadListings ? (
          <View className="mt-6">
            <RecentListingsSection onViewAll={() => router.push('/listings')} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
