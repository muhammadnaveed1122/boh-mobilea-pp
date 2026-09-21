import { Pressable, View } from 'react-native';
import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { useFunnelStats } from '../hooks/use-funnel-stats';

interface AllLeadsHeaderProps {
  canCreate: boolean;
  onCreatePress: () => void;
}

export function AllLeadsHeader({ canCreate, onCreatePress }: Readonly<AllLeadsHeaderProps>) {
  const { data } = useFunnelStats();
  const total = data?.totalLeads ?? 0;
  const fg = useThemeColor('--foreground');

  return (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      <BackButton />
      <View className="flex-row items-center gap-2">
        <Text className="text-2xl font-bold text-foreground">All Leads</Text>
        <View className="rounded-full bg-brand px-2.5 py-0.5">
          <Text className="text-xs font-bold text-brand-foreground">{total}</Text>
        </View>
      </View>
      {canCreate ? (
        <Pressable
          onPress={onCreatePress}
          accessibilityLabel="Create lead"
          className="h-10 w-10 items-center justify-center rounded-xl bg-card active:opacity-70"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <Icon name="Plus" size={20} color={fg} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}
