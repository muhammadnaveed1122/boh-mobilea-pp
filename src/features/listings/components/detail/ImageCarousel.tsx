import { useState } from 'react';
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { ListingDetail, ListingMediaItem } from '../../types';
import { HERO_GRADIENT } from '../../lib/visuals';

const HERO_HEIGHT = 300;

function heroMedia(detail: ListingDetail): ListingMediaItem[] {
  const items = detail.media?.hero ?? [];
  return [...items]
    .filter((m) => !(m.mediaType?.toLowerCase().includes('video') ?? false))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/listings');
}

function CircleButton({
  icon,
  label,
  onPress,
}: Readonly<{ icon: IconName; label: string; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/35 active:opacity-70"
    >
      <Icon name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

export function ImageCarousel({
  detail,
  topInset,
  onEdit,
}: Readonly<{ detail: ListingDetail; topInset: number; onEdit?: () => void }>) {
  const { width } = useWindowDimensions();
  const media = heroMedia(detail);
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={{ height: HERO_HEIGHT }} className="w-full">
      {media.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
        >
          {media.map((item) => (
            <Image
              key={item.id}
              source={{ uri: item.mediaUrl }}
              style={{ width, height: HERO_HEIGHT }}
              className="bg-muted"
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : (
        <LinearGradient
          colors={HERO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height: '100%' }}
        >
          <View className="flex-1 items-center justify-center">
            <Icon name="Building2" size={56} color="rgba(255,255,255,0.3)" />
          </View>
        </LinearGradient>
      )}

      {/* Top scrim under the floating controls */}
      <LinearGradient
        colors={['rgba(8,12,22,0.5)', 'rgba(8,12,22,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: topInset + 60 }}
        pointerEvents="none"
      />

      {/* Back button */}
      <View className="absolute left-4" style={{ top: topInset + 6 }}>
        <CircleButton icon="ArrowLeft" label="Go back" onPress={goBack} />
      </View>

      {/* Edit action (top-right, mirrors the back button) */}
      {onEdit ? (
        <View className="absolute right-4" style={{ top: topInset + 6 }}>
          <CircleButton icon="Pencil" label="Edit listing" onPress={onEdit} />
        </View>
      ) : null}

      {/* Counter */}
      {media.length > 1 ? (
        <View className="absolute bottom-4 right-4 rounded-full bg-black/55 px-2.5 py-1">
          <Text className="text-xs font-semibold text-white">
            {index + 1} / {media.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
