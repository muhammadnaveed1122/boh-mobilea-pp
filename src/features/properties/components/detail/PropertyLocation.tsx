import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { SectionWrap } from '@/features/new-projects/components/detail/SectionWrap';
import { useThemeColor } from '@theme';
import type { PropertyDetail } from '../../types';

const MAP_HEIGHT = 200;

/** First nearby-place entry with valid coords, used to center the map when no pin is set. */
function firstEntryCoord(
  categories: NonNullable<PropertyDetail['locationSection']>['categories'],
): { latitude: number; longitude: number } | undefined {
  for (const c of categories) {
    for (const g of c.distanceGroups) {
      for (const e of g.entries) {
        if (typeof e.latitude === 'number' && typeof e.longitude === 'number') {
          return { latitude: e.latitude, longitude: e.longitude };
        }
      }
    }
  }
  return undefined;
}

export function PropertyLocation({
  location,
}: Readonly<{ location: PropertyDetail['locationSection'] }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const success = useThemeColor('--success');
  const categories = location?.categories ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (!location || (!location.customPinLocation && categories.length === 0)) return null;

  const active = categories[activeIndex] ?? categories[0];
  const center = location.customPinLocation ?? firstEntryCoord(categories);

  return (
    <SectionWrap title={location.title || 'Location'} tagline={location.tagline}>
      {center ? (
        <View
          className="mb-4 overflow-hidden rounded-2xl border border-border"
          style={{ height: MAP_HEIGHT }}
        >
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: center.latitude,
              longitude: center.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker coordinate={center} title={location.title} />
          </MapView>
        </View>
      ) : null}

      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          className="-mx-4 mb-4 px-4"
        >
          {categories.map((c, i) => {
            const isActive = i === activeIndex;
            return (
              <Pressable
                key={`${i}-${c.name}`}
                onPress={() => setActiveIndex(i)}
                className={`rounded-full px-4 py-2 ${isActive ? 'bg-brand' : 'border border-border bg-background'}`}
              >
                <Text
                  className={`text-sm font-medium ${isActive ? 'text-brand-foreground' : 'text-foreground'}`}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View className="gap-4">
        {(active?.distanceGroups ?? [])
          .filter((g) => g.entries.length > 0)
          .map((g, gi) => (
            <View key={`${gi}-${g.rangeLabel}`}>
              <View className="mb-2 flex-row items-center gap-2">
                <Icon name="Car" size={18} color={success} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  {g.rangeLabel}
                </Text>
              </View>
              <View className="rounded-2xl border border-border bg-card">
                {g.entries.map((e, ei) => (
                  <View
                    key={`${ei}-${e.name}`}
                    className={`flex-row items-start gap-3 px-4 py-3 ${ei === 0 ? '' : 'border-t border-border'}`}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Icon name="MapPin" size={15} color={mutedFg} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{e.name}</Text>
                      {e.address ? (
                        <Text className="mt-0.5 text-xs text-muted-foreground">{e.address}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
      </View>
    </SectionWrap>
  );
}
