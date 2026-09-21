import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import {
  type Coords,
  requestAndGetCurrentCoords,
  reverseGeocode,
  toMessageLocation,
} from '../media/location';
import {
  type NearbyPlace,
  type PlacePrediction,
  nearbyPlaces,
  placeAutocomplete,
  placeDetails,
} from '../api/places';
import type { MessageLocation } from '../models/message';
import { useLocationDraft } from '../store/location-draft';

const DUBAI: Coords = { latitude: 25.2048, longitude: 55.2708 };
const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

interface Props {
  conversationId: string;
  onDone: () => void;
}

export function LocationPicker({ conversationId, onDone }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');
  const mutedColor = useThemeColor('--muted-foreground');
  const mapRef = useRef<MapView>(null);
  const setDraft = useLocationDraft((s) => s.setDraft);

  const [center, setCenter] = useState<Coords>(DUBAI);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [ready, setReady] = useState(false);

  // Initial: current location → recenter map → load nearby.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const coords = (await requestAndGetCurrentCoords()) ?? DUBAI;
      if (!alive) return;
      setCenter(coords);
      setReady(true);
      mapRef.current?.animateToRegion({ ...coords, ...DELTA }, 350);
      const meta = await reverseGeocode(coords);
      if (alive) setAddress(meta.address ?? meta.name);
      const places = await nearbyPlaces(coords);
      if (alive) setNearby(places);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Reverse-geocode the map center after the user pans (map center is the pin).
  const onRegionChangeComplete = useCallback((region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    setCenter(coords);
    reverseGeocode(coords).then((meta) => setAddress(meta.address ?? meta.name));
  }, []);

  // Debounced autocomplete.
  useEffect(() => {
    if (query.trim().length < 2) {
      setPredictions([]);
      return;
    }
    const t = setTimeout(() => {
      placeAutocomplete(query, center).then(setPredictions);
    }, 300);
    return () => clearTimeout(t);
  }, [query, center]);

  const send = useCallback(
    (location: MessageLocation) => {
      setDraft({ conversationId, location });
      onDone();
    },
    [conversationId, onDone, setDraft],
  );

  const sendCurrentPin = useCallback(() => {
    send(toMessageLocation(center, { address }));
  }, [center, address, send]);

  const pickPrediction = useCallback(
    (placeId: string) => {
      placeDetails(placeId).then((loc) => {
        if (!loc) return;
        setQuery('');
        setPredictions([]);
        setCenter({ latitude: loc.latitude, longitude: loc.longitude });
        mapRef.current?.animateToRegion(
          { latitude: loc.latitude, longitude: loc.longitude, ...DELTA },
          350,
        );
        send(loc);
      });
    },
    [send],
  );

  const recenter = useCallback(() => {
    requestAndGetCurrentCoords().then((coords) => {
      if (!coords) return;
      setCenter(coords);
      mapRef.current?.animateToRegion({ ...coords, ...DELTA }, 350);
    });
  }, []);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Search bar */}
      <View className="flex-row items-center border-b border-border px-3 py-2">
        <Pressable onPress={onDone} accessibilityLabel="Close" hitSlop={8} className="pr-2">
          <Icon name="ArrowLeft" size={22} color={mutedColor} />
        </Pressable>
        <View className="flex-1 flex-row items-center rounded-full bg-muted px-3">
          <Icon name="Search" size={16} color={mutedColor} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search places"
            placeholderTextColor={mutedColor}
            className="ml-2 h-10 flex-1 text-foreground"
          />
        </View>
      </View>

      {predictions.length > 0 ? (
        <FlatList
          data={predictions}
          keyExtractor={(p) => p.placeId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pickPrediction(item.placeId)}
              className="border-b border-border px-4 py-3 active:bg-muted"
            >
              <Text className="text-foreground">{item.primary}</Text>
              {item.secondary ? (
                <Text className="text-xs text-muted-foreground">{item.secondary}</Text>
              ) : null}
            </Pressable>
          )}
        />
      ) : (
        <>
          <View className="flex-1">
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={{ ...DUBAI, ...DELTA }}
              showsUserLocation
              onRegionChangeComplete={onRegionChangeComplete}
            />
            {/* Fixed center pin */}
            <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
              <Icon name="MapPin" size={36} color={primary} />
            </View>
            {/* Recenter FAB */}
            <Pressable
              onPress={recenter}
              accessibilityLabel="Recenter"
              className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-80"
              style={{ elevation: 3 }}
            >
              <Icon name="LocateFixed" size={20} color={primary} />
            </Pressable>
            {!ready ? (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color={primary} />
              </View>
            ) : null}
          </View>

          {/* Send this location + nearby places */}
          <View className="flex-1">
            <FlatList
              data={nearby}
              keyExtractor={(p) => p.placeId}
              ListHeaderComponent={
                <Pressable
                  onPress={sendCurrentPin}
                  className="flex-row items-center border-b border-border px-4 py-3 active:bg-muted"
                >
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Icon name="MapPin" size={20} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-foreground">Send this location</Text>
                    {address ? (
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {address}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    send({
                      latitude: item.latitude,
                      longitude: item.longitude,
                      name: item.name,
                      address: item.address,
                    })
                  }
                  className="flex-row items-center border-b border-border px-4 py-3 active:bg-muted"
                >
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Icon name="MapPin" size={16} color={mutedColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.address ? (
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {item.address}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          </View>
        </>
      )}
    </View>
  );
}
