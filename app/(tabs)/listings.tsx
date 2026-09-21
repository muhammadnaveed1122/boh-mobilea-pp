import { Redirect, useLocalSearchParams } from 'expo-router';
import { ListingsLandingScreen } from '@/features/listings/components/ListingsLandingScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function ListingsRoute() {
  // Landing browses primary + secondary listings — allow either read scope.
  // Must match the tab-visibility gate in BottomTabBar, else the tab shows but
  // tapping redirects home.
  const state = useRequirePermission([
    PERMISSIONS.LISTINGS_READ,
    PERMISSIONS.OPPORTUNITY_LISTING_READ,
  ]);
  const { dateFrom, dateTo } = useLocalSearchParams<{ dateFrom?: string; dateTo?: string }>();
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <ListingsLandingScreen dateFrom={dateFrom} dateTo={dateTo} />;
}
