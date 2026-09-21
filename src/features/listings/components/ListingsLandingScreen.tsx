import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatDayLabel } from '@/lib/format/dubai';
import { cn } from '@/lib/utils';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';
import type { ListingsPurpose } from '../types';
import { ListingsBrowseScreen, ListingsCountCompare } from './ListingsBrowseScreen';

const TABS: readonly { purpose: ListingsPurpose; label: string }[] = [
  { purpose: 'sale', label: 'Sell' },
  { purpose: 'rent', label: 'Rent' },
];

function PurposeTab({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className={cn(
        'flex-1 items-center border-b-2 pb-3 pt-1',
        active ? 'border-brand' : 'border-transparent',
      )}
    >
      <Text className={cn('text-base font-bold', active ? 'text-brand' : 'text-muted-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Dismissible chip for the route's creation-date window.
 *
 * Listings is a bottom TAB, and the custom `BottomTabBar` navigates with
 * `navigation.navigate(route)` and no params — React Navigation RETAINS the
 * params already on the tab route. So without an explicit way out, one tap on
 * the dashboard's "Today's Listings" tile would pin the tab to that date for
 * the rest of the session (and silently show yesterday's date tomorrow).
 * Clearing the params here is the escape hatch.
 */
function DateFilterChip({
  dateFrom,
  dateTo,
  onClear,
}: Readonly<{ dateFrom?: string; dateTo?: string; onClear: () => void }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const from = formatDayLabel(dateFrom);
  const to = formatDayLabel(dateTo);
  if (from === '' && to === '') return null;

  const range = from !== '' && to !== '' && from !== to ? `${from} – ${to}` : from || to;

  return (
    <View className="px-5 pb-2 pt-1">
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel={`Clear date filter, created ${range}`}
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        className="flex-row items-center gap-1.5 self-start rounded-full border border-border bg-muted px-3 py-1.5"
      >
        <Text className="text-xs font-semibold text-foreground">Created: {range}</Text>
        <Icon name="X" size={13} color={mutedFg} />
      </Pressable>
    </View>
  );
}

interface ListingsLandingScreenProps {
  /**
   * Inclusive ISO (`YYYY-MM-DD`) creation-date window from the route, e.g.
   * `/listings?dateFrom=2026-07-13&dateTo=2026-07-13` from the dashboard's
   * "Today's Listings" tile. Surfaced as a dismissible chip — because this is a
   * tab route, the params outlive the visit unless the user clears them. The
   * purpose (Sell/Rent) tabs stay local `useState`, not URL params.
   */
  dateFrom?: string;
  dateTo?: string;
}

export function ListingsLandingScreen({
  dateFrom,
  dateTo,
}: Readonly<ListingsLandingScreenProps> = {}) {
  const [purpose, setPurpose] = useState<ListingsPurpose>('sale');
  const [total, setTotal] = useState(0);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useBottomTabBarSpace();
  const brandFg = useThemeColor('--brand-foreground');
  const canCreate = useCan([PERMISSIONS.LISTINGS_CREATE, PERMISSIONS.OPPORTUNITY_LISTING_CREATE]);

  const onCreate = () => router.push('/listings/create');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-1">
        <Text className="flex-1 text-2xl font-extrabold text-foreground">Listings</Text>
        <ListingsCountCompare total={total} />
      </View>

      <DateFilterChip
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClear={() => router.setParams({ dateFrom: undefined, dateTo: undefined })}
      />

      <View className="flex-row border-b border-border px-5">
        {TABS.map((tab) => (
          <PurposeTab
            key={tab.purpose}
            label={tab.label}
            active={purpose === tab.purpose}
            onPress={() => setPurpose(tab.purpose)}
          />
        ))}
      </View>

      <ListingsBrowseScreen
        purpose={purpose}
        embedded
        onTotalChange={setTotal}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {canCreate ? (
        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="Create listing"
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
