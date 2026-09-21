import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
import { useThemeColor } from '@theme';
import type { ProjectHeroSection, ProjectMediaItem } from '../../types';
import { isVideoMedia, sortMedia } from '../../utils/media';

const HEIGHT = 380;

interface Props {
  hero: ProjectHeroSection | null;
  fallbackTitle?: string;
  shareUrl?: string;
  projectId?: string;
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
}: Readonly<{
  icon: 'ArrowLeft' | 'Share2' | 'VolumeX' | 'Volume2';
  onPress: () => void;
  label: string;
}>) {
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

export function HeroCarousel({ hero, fallbackTitle, shareUrl, projectId }: Readonly<Props>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const listRef = useRef<FlatList<ProjectMediaItem>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  const media = useMemo(() => sortMedia(hero?.media), [hero?.media]);
  const hasMedia = media.length > 0;
  const currentIsVideo = isVideoMedia(media[index]);

  const renderItem = useCallback(
    ({ item }: { item: ProjectMediaItem }) =>
      isVideoMedia(item) ? (
        <HeroVideo uri={item.mediaUrl} muted={muted} width={width} />
      ) : (
        <Image
          source={{ uri: item.mediaUrl }}
          style={{ width, height: HEIGHT }}
          resizeMode="cover"
        />
      ),
    [muted, width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<ProjectMediaItem> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  async function handleShare() {
    const title = fallbackTitle || hero?.projectName || 'Project';
    // Share the web project link so the receiving app fetches the page's OG
    // meta title/description and renders a rich preview (matches web behaviour).
    const message = shareUrl ? `${title}\n${shareUrl}` : title;
    try {
      await Share.share(
        // iOS: `url` is shared separately for the rich link preview; Android
        // only reads `message`, so the link is embedded there too.
        shareUrl ? { title, message, url: shareUrl } : { title, message },
      );
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
          keyExtractor={(m) => m.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            setIndex(i);
          }}
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
          {projectId ? (
            <FavoriteHeartButton kind={FavoriteResourceKind.PROJECT} id={projectId} />
          ) : null}
          <CircleButton icon="Share2" onPress={handleShare} label="Share" />
        </View>
      </View>

      {media.length > 1 ? (
        <View className="absolute bottom-12 left-0 right-0 flex-row items-center justify-center gap-1.5">
          {media.map((m, i) => (
            <View
              key={m.id}
              className={`h-1.5 rounded-full ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </View>
      ) : null}

      {media.length > 1 ? (
        <View
          className="absolute bottom-12 right-4 rounded-full px-3 py-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <Text className="text-xs font-semibold text-white">
            {index + 1} / {media.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
