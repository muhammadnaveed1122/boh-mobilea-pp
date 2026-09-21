import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import type { ProjectLocationSection } from '../../types';
import { SectionWrap } from './SectionWrap';

interface Props {
  location: ProjectLocationSection | null;
}

const MAP_HEIGHT = 200;

/** First nearby-place entry with valid coords, used to center the map when no pin/mapCenter is set. */
function firstEntryCoord(
  categories: ProjectLocationSection['categories'],
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

export function LocationSection({ location }: Readonly<Props>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const success = useThemeColor('--success');
  const categories = useMemo(
    () => (location?.categories ?? []).filter((c) => c.isVisible !== false),
    [location],
  );
  const [activeId, setActiveId] = useState(categories[0]?.id ?? '');

  if (!location || (!location.mapCenter && categories.length === 0)) return null;

  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  const center = location.customPinLocation ?? location.mapCenter ?? firstEntryCoord(categories);

  return (
    <SectionWrap
      title={location.title || location.mainHeading || 'Location'}
      tagline={location.subtitle || location.tagline}
    >
      {center ? (
        <View
          className="mb-4 overflow-hidden rounded-2xl border border-border"
          style={{ height: MAP_HEIGHT }}
          pointerEvents="box-none"
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
            <Marker
              coordinate={{ latitude: center.latitude, longitude: center.longitude }}
              title={location.mainHeading}
            />
          </MapView>
        </View>
      ) : null}

      {location.locationUnavailable ? (
        <Text variant="muted" className="text-center">
          Nearby locations temporarily unavailable.
        </Text>
      ) : null}

      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          className="-mx-4 mb-4 px-4"
        >
          {categories.map((c) => {
            const isActive = c.id === active?.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setActiveId(c.id)}
                className={`rounded-full px-4 py-2 ${
                  isActive ? 'bg-brand' : 'border border-border bg-background'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive ? 'text-brand-foreground' : 'text-foreground'
                  }`}
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
          .map((g) => (
            <View key={g.id}>
              {/* Group header: green car icon + drive-time range */}
              <View className="mb-2 flex-row items-center gap-2">
                <Icon name="Car" size={18} color={success} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  {g.rangeLabel}
                </Text>
              </View>

              <View className="rounded-2xl border border-border bg-card">
                {g.entries.map((e, ei) => (
                  <View
                    key={e.id}
                    className={`flex-row items-start gap-3 px-4 py-3 ${
                      ei === 0 ? '' : 'border-t border-border'
                    }`}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Icon name="Car" size={15} color={mutedFg} />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled
                      className="flex-1"
                      contentContainerStyle={{ alignItems: 'flex-start' }}
                    >
                      <View>
                        <Text className="text-sm font-medium text-foreground">{e.name}</Text>
                        {e.address ? (
                          <Text className="mt-0.5 text-xs text-muted-foreground">{e.address}</Text>
                        ) : null}
                      </View>
                    </ScrollView>
                    {typeof e.driveTimeMinutes === 'number' ? (
                      <View className="rounded-full bg-muted px-2.5 py-1">
                        <Text className="text-xs font-semibold text-foreground">
                          {e.driveTimeMinutes} min
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
      </View>
    </SectionWrap>
  );
}
