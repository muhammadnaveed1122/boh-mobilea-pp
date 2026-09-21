import { ActivityIndicator, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useCommunityGeocode } from '../hooks/use-wizard-options';

const DUBAI = { latitude: 25.2048, longitude: 55.2708 };

export function CommunityMap({ communityName }: Readonly<{ communityName?: string }>) {
  const { data, isLoading } = useCommunityGeocode(communityName);
  const center = data ?? DUBAI;
  const delta = data ? 0.05 : 0.4;

  return (
    <View className="h-44 overflow-hidden rounded-2xl border border-border">
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        region={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        pointerEvents="none"
      >
        {data ? <Marker coordinate={center} /> : null}
      </MapView>
      {isLoading ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      ) : null}
    </View>
  );
}
