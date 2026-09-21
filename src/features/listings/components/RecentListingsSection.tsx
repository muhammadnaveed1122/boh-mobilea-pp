import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useThemeColor } from '@theme';
import { Text } from '@/components/atoms/Text';
import { useListingsInfinite } from '../hooks/use-listings';
import { normalizeSecondaryRow } from '../lib/normalize-row';
import { UnifiedListingCard } from './UnifiedListingCard';

const RECENT_LIMIT = 6;
const CARD_WIDTH = 320;

export function RecentListingsSection({ onViewAll }: Readonly<{ onViewAll?: () => void }>) {
  const brand = useThemeColor('--brand');
  const { data, isLoading, isError, error } = useListingsInfinite({});
  const rows =
    data?.pages
      .flatMap((p) => p.items)
      .slice(0, RECENT_LIMIT)
      .map(normalizeSecondaryRow) ?? [];

  return (
    <View>
      <View className="flex-row items-center justify-between px-4">
        <Text className="text-base font-bold text-foreground">Recent Listings</Text>
        <Pressable onPress={onViewAll} className="active:opacity-70">
          <Text className="text-xs font-medium text-info underline">View All</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator color={brand} />
        </View>
      ) : null}

      {isError ? (
        <View className="mx-4 mt-3 rounded-xl bg-destructive/10 px-3 py-2">
          <Text className="text-xs text-destructive">
            {error?.message ?? 'Failed to load listings.'}
          </Text>
        </View>
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-sm text-muted-foreground">No listings yet.</Text>
        </View>
      ) : null}

      {rows.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
        >
          {rows.map((row) => (
            <View key={row.id} style={{ width: CARD_WIDTH }}>
              <UnifiedListingCard row={row} stages={[]} fillHeight />
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
