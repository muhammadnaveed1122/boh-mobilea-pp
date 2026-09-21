import { View } from 'react-native';
import { Card } from '@/components/molecules/Card';
import { Text } from '@/components/atoms/Text';
import { useFunnelStats } from '../hooks/use-funnel-stats';

type TileVariant = 'brandSoft' | 'warningSoft' | 'successSoft' | 'infoSoft' | 'destructiveSoft';

interface StatTileProps {
  value: number;
  label: string;
  variant: TileVariant;
}

function StatTile({ value, label, variant }: Readonly<StatTileProps>) {
  return (
    <Card variant={variant} className="flex-1 items-center py-3 shadow-none">
      <Text className="text-2xl font-bold">{value}</Text>
      <Text className="text-xs font-medium">{label}</Text>
    </Card>
  );
}

export function LeadStatTiles() {
  const { data } = useFunnelStats();
  const total = data?.totalLeads ?? 0;
  const active = data?.activeLeads ?? 0;
  const closed = data?.closedDeals ?? 0;

  return (
    <View className="flex-row gap-3 px-4">
      <StatTile value={total} label="Total" variant="brandSoft" />
      <StatTile value={active} label="Active" variant="warningSoft" />
      <StatTile value={closed} label="Closed" variant="successSoft" />
    </View>
  );
}
