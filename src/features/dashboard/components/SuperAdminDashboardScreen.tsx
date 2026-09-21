import { ScrollView, View } from 'react-native';

import { AppMainHeader } from '@/components/organisms';
import { useAgentPresence } from '@/features/agents/hooks/use-agent-presence';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useInvalidateOnTabFocus } from '@/lib/tab-focus-refresh';

import { LeadFunnelChart } from './LeadFunnelChart';
import { SuperAdminStatTiles } from './SuperAdminStatTiles';

/**
 * Super-admin home tab: six tap-through stat tiles (leads/listings/agents) and the
 * lead funnel chart. Rendered by the `/(tabs)/index.tsx` role fork for
 * `useRole().isSuperAdmin` only — a routing decision, not a permission gate.
 */
export function SuperAdminDashboardScreen() {
  const bottomSpace = useBottomTabBarSpace();
  useInvalidateOnTabFocus([
    ['dashboard', 'overview'],
    ['dashboard', 'lead-funnel'],
  ]);
  useAgentPresence();

  return (
    <View className="flex-1 bg-background">
      <AppMainHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomSpace + 24 }}
      >
        <View className="mt-4">
          <SuperAdminStatTiles />
        </View>
        <LeadFunnelChart />
      </ScrollView>
    </View>
  );
}
