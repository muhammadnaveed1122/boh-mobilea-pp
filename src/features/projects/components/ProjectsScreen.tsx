import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { ToggleGroup, ToggleGroupItem } from '@/components/atoms/ToggleGroup';
import { useThemeColor } from '@theme';
import {
  formatAED,
  LISTINGS,
  STATUS_STYLES,
  type Listing,
  type ListingStatus,
} from '@/features/projects/data';

const FILTERS: readonly ('All' | ListingStatus)[] = [
  'All',
  'Draft',
  'Submitted',
  'Approved',
  'Published',
];

function StatusPill({ status }: Readonly<{ status: ListingStatus }>) {
  const s = STATUS_STYLES[status];
  return (
    <View className="self-start rounded-md px-2 py-1" style={{ backgroundColor: s.bg }}>
      <Text className="text-xs font-semibold" style={{ color: s.fg }}>
        {status}
      </Text>
    </View>
  );
}

function ListingCard({ listing }: Readonly<{ listing: Listing }>) {
  const brand = useThemeColor('--brand');
  const brandMuted = useThemeColor('--brand-muted');
  return (
    <Pressable
      onPress={() => router.push(`/projects/${listing.id}`)}
      className="flex-row items-start rounded-2xl bg-card p-4 active:opacity-80"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <View
        className="mr-3 h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: brandMuted }}
      >
        <Icon name="Building2" size={22} color={brand} />
      </View>

      <View className="flex-1">
        <Text className="text-base font-bold text-foreground">{listing.title}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">{listing.location}</Text>
        <Text className="mt-1 text-base font-bold text-foreground">
          {formatAED(listing.priceAED)}
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          {listing.type} · {listing.beds}bd · {listing.baths}ba ·{' '}
          {listing.sqft.toLocaleString('en-US')} sqft
        </Text>
      </View>

      <View className="ml-2">
        <StatusPill status={listing.status} />
      </View>
    </Pressable>
  );
}

export function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'All' | ListingStatus>('All');

  const filtered = useMemo(() => {
    if (filter === 'All') return LISTINGS;
    return LISTINGS.filter((l) => l.status === filter);
  }, [filter]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <BackButton />
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl font-bold text-foreground">My Listings</Text>
          <View className="rounded-full bg-brand px-2.5 py-0.5">
            <Text className="text-xs font-bold text-brand-foreground">{LISTINGS.length}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as 'All' | ListingStatus)}
            className="flex-row gap-2"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f}>
                <Text>{f}</Text>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ScrollView>

        <Text className="mt-4 px-4 text-sm text-muted-foreground">{filtered.length} listings</Text>

        <View className="mt-2 gap-3 px-4">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
