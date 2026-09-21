import { View } from 'react-native';
import { BackButton } from '@/components/atoms/BackButton';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useFunnelStats } from '../hooks/use-funnel-stats';

export function LeadsTopBar() {
  const { data } = useFunnelStats();
  const total = data?.totalLeads ?? 0;
  const canSeeAll = useCan(PERMISSIONS.LEADS_READ_ALL);
  const title = canSeeAll ? 'All Leads' : 'My Leads';
  return (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      <BackButton />
      <View className="flex-row items-center gap-2">
        <Text className="text-2xl font-bold text-foreground">{title}</Text>
        <View className="rounded-full bg-brand px-2.5 py-0.5">
          <Text className="text-xs font-bold text-brand-foreground">{total}</Text>
        </View>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );
}
