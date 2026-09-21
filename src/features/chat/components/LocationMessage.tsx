import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor, useThemeColorAlpha } from '@theme';

import type { MessageLocation } from '../models/message';

const PREVIEW_HEIGHT = 120;
const PREVIEW_DELTA = 0.008;

/** Deep-link into the platform maps app for the given coordinates. */
function mapsUrl({ latitude, longitude, name }: MessageLocation): string {
  const label = name ? encodeURIComponent(name) : '';
  if (Platform.OS === 'ios') {
    return `maps://?q=${label}&ll=${latitude},${longitude}`;
  }
  return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
}

/** Apple Maps deep link (iOS only; falls back to the shared web URL elsewhere). */
function appleMapsUrl({ latitude, longitude, name }: MessageLocation): string {
  const label = name ? encodeURIComponent(name) : '';
  return `maps://?q=${label}&ll=${latitude},${longitude}`;
}

/** Google Maps app deep link. */
function googleMapsAppUrl({ latitude, longitude }: MessageLocation): string {
  return `comgooglemaps://?q=${latitude},${longitude}&center=${latitude},${longitude}`;
}

/** Web fallback shared across platforms if the native maps scheme is refused. */
function webMapsUrl({ latitude, longitude }: MessageLocation): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Apple Maps web fallback, used when the native scheme is unavailable. */
function appleWebMapsUrl({ latitude, longitude }: MessageLocation): string {
  return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${latitude},${longitude}`;
}

/** Open the first URL that the OS accepts, walking the list in order. */
async function openFirstAvailable(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try the next candidate
    }
  }
}

export function LocationMessage({ location }: Readonly<{ location: MessageLocation }>) {
  const accent = useThemeColor('--info');
  const accentTint = useThemeColorAlpha('--info', 0.13);

  const openApple = useCallback(() => {
    const candidates =
      Platform.OS === 'ios'
        ? [appleMapsUrl(location), appleWebMapsUrl(location)]
        : [appleWebMapsUrl(location)];
    void openFirstAvailable(candidates);
  }, [location]);

  const openGoogle = useCallback(() => {
    const candidates =
      Platform.OS === 'android'
        ? [googleMapsAppUrl(location), mapsUrl(location), webMapsUrl(location)]
        : [googleMapsAppUrl(location), webMapsUrl(location)];
    void openFirstAvailable(candidates);
  }, [location]);

  const open = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Open location in',
          options: ['Apple Maps', 'Google Maps', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) openApple();
          if (index === 1) openGoogle();
        },
      );
      return;
    }

    Alert.alert('Open location in', undefined, [
      { text: 'Google Maps', onPress: openGoogle },
      { text: 'Apple Maps', onPress: openApple },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [openApple, openGoogle]);

  const title =
    location.name ??
    location.address ??
    `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  const showCoords = Boolean(location.name ?? location.address);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Choose an app to open this location"
      className="w-[240px] overflow-hidden rounded-xl border border-border bg-background/40 active:opacity-70"
    >
      <View pointerEvents="none" style={{ height: PREVIEW_HEIGHT }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          liteMode
          cacheEnabled
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: PREVIEW_DELTA,
            longitudeDelta: PREVIEW_DELTA,
          }}
        >
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title={location.name ?? undefined}
          />
        </MapView>
      </View>
      <View className="flex-row items-center p-2.5">
        <View
          className="mr-2.5 h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: accentTint }}
        >
          <Icon name="MapPin" size={22} color={accent} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
            {title}
          </Text>
          {showCoords ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text className="text-xs text-muted-foreground">Tap to view on map</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
