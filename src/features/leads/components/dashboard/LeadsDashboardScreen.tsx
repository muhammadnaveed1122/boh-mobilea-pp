import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';
import { OverviewView } from './overview/OverviewView';

export function LeadsDashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useBottomTabBarSpace();
  const brandFg = useThemeColor('--brand-foreground');
  const canCreate = useCan(PERMISSIONS.LEADS_CREATE);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-5 pb-2 pt-1">
        <Text className="text-2xl font-extrabold text-foreground">Leads</Text>
      </View>

      <View className="flex-1">
        <OverviewView />
      </View>

      {canCreate ? (
        <Pressable
          onPress={() => router.push('/leads/create')}
          accessibilityRole="button"
          accessibilityLabel="Create lead"
          style={{
            position: 'absolute',
            right: 16,
            bottom: tabBarSpace,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
          className="h-14 w-14 items-center justify-center rounded-full bg-brand"
        >
          <Icon name="Plus" size={24} color={brandFg} />
        </Pressable>
      ) : null}
    </View>
  );
}
