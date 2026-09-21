import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useActiveListingsCount } from '@/features/listings/hooks/use-active-listings-count';
import { useFunnelStats } from '../hooks/use-funnel-stats';

interface TileProps {
  value: number;
  label: string;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  onPress?: () => void;
}

function StatTile({ value, label, iconBg, iconColor, cardBg, onPress }: Readonly<TileProps>) {
  return (
    <Pressable onPress={onPress} className={`flex-1 rounded-2xl p-4 active:opacity-80 ${cardBg}`}>
      <View className="flex-row items-start justify-between">
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon name="Building2" size={20} color={iconColor} />
        </View>
        <View className="h-7 w-7 items-center justify-center rounded-full bg-card">
          <Icon name="ArrowUpRight" size={14} />
        </View>
      </View>
      <Text className="mt-6 text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

// Owns its query so the listings stat is only fetched when rendered (permission-gated).
function ActiveListingsTile() {
  const { data: activeListings } = useActiveListingsCount();
  const brandFg = useThemeColor('--brand-foreground');
  return (
    <StatTile
      value={activeListings ?? 0}
      label="Active Listings"
      iconBg="bg-brand"
      iconColor={brandFg}
      cardBg="bg-brand/10"
      onPress={() => router.push('/listings')}
    />
  );
}

// Owns its query so the leads stat is only fetched when rendered (permission-gated).
function NewLeadsTile() {
  const { data } = useFunnelStats();
  const warningFg = useThemeColor('--warning-foreground');
  return (
    <StatTile
      value={data?.totalLeads ?? 0}
      label="New Leads"
      iconBg="bg-warning"
      iconColor={warningFg}
      cardBg="bg-warning/10"
    />
  );
}

interface LeadsHomeStatTilesProps {
  canReadLeads: boolean;
  canReadListings: boolean;
}

export function LeadsHomeStatTiles({
  canReadLeads,
  canReadListings,
}: Readonly<LeadsHomeStatTilesProps>) {
  if (!canReadLeads && !canReadListings) return null;

  return (
    <View className="mt-4 flex-row gap-3 px-4">
      {canReadListings ? <ActiveListingsTile /> : null}
      {canReadLeads ? <NewLeadsTile /> : null}
    </View>
  );
}
