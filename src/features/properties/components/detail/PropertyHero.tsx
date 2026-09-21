import { useCallback, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
import { useThemeColor } from '@theme';
import type { PropertyMedia } from '../../types';

const HEIGHT = 380;

interface Props {
  media: PropertyMedia[];
  title: string;
  favoriteId?: string;
  shareUrl?: string;
}

function HeroVideo({
  uri,
  muted,
  width,
}: Readonly<{ uri: string; muted: boolean; width: number }>) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });
  player.muted = muted;
  return (
    <VideoView
      player={player}
      style={{ width, height: HEIGHT }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function CircleButton({
  icon,
  onPress,
  label,
}: Readonly<{ icon: IconName; onPress: () => void; label: string }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    >
      <Icon name={icon} size={18} color="#fff" />
    </Pressable>
  );
}

export function PropertyHero({ media, title, favoriteId, shareUrl }: Readonly<Props>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const listRef = useRef<FlatList<PropertyMedia>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  const hasMedia = media.length > 0;
  const currentIsVideo = media[index]?.type === 'video';

  const renderItem = useCallback(
    ({ item }: { item: PropertyMedia }) =>
      item.type === 'video' ? (
        <HeroVideo uri={item.url} muted={muted} width={width} />
      ) : (
        <Image source={{ uri: item.url }} style={{ width, height: HEIGHT }} resizeMode="cover" />
      ),
    [muted, width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<PropertyMedia> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  async function handleShare() {
    const message = shareUrl ? `${title}\n${shareUrl}` : title;
    try {
      await Share.share(shareUrl ? { title, message, url: shareUrl } : { title, message });
    } catch {
      // ignore
    }
  }

  return (
    <View
      className="relative w-full bg-muted"
      style={{ height: HEIGHT }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {hasMedia && width > 0 ? (
        <FlatList
          ref={listRef}
          data={media}
          keyExtractor={(m, i) => `${i}-${m.url}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          getItemLayout={getItemLayout}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          renderItem={renderItem}
        />
      ) : (
        <View className="h-full w-full items-center justify-center bg-muted">
          <Icon name="Building2" size={60} color={mutedFg} />
        </View>
      )}

      <View
        pointerEvents="none"
        className="absolute inset-x-0 bottom-0 h-32"
        style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      />

      <View className="absolute inset-x-4 flex-row items-center justify-between" style={{ top: 8 }}>
        <CircleButton icon="ArrowLeft" onPress={() => router.back()} label="Go back" />
        <View className="flex-row gap-2">
          {currentIsVideo ? (
            <CircleButton
              icon={muted ? 'VolumeX' : 'Volume2'}
              onPress={() => setMuted((m) => !m)}
              label={muted ? 'Unmute' : 'Mute'}
            />
          ) : null}
          {favoriteId ? (
            <FavoriteHeartButton kind={FavoriteResourceKind.LISTING} id={favoriteId} />
          ) : null}
          <CircleButton icon="Share2" onPress={handleShare} label="Share" />
        </View>
      </View>

      {media.length > 1 ? (
        <View className="absolute bottom-12 left-0 right-0 flex-row items-center justify-center gap-1.5">
          {media.map((m, i) => (
            <View
              key={`${i}-${m.url}`}
              className={`h-1.5 rounded-full ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
