import { useCallback, useRef, useState, type ReactNode } from 'react';
import { FlatList, Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/atoms/Icon';
import { CarouselAutoplayToggle } from '@/components/molecules/CarouselAutoplayToggle';
import { CarouselIndicator } from '@/components/molecules/CarouselIndicator';
import { useAutoSlide } from '@/features/new-projects/hooks/use-auto-slide';
import { useThemeColor } from '@theme';
import type { PropertyCardMedia } from '../types';
import { CarouselVideoSlide } from './CarouselVideoSlide';

const AUTO_SLIDE_MS = 3500;

interface Props {
  media: PropertyCardMedia[];
  height: number;
  /** Overlay nodes (favorite, badge). */
  children?: ReactNode;
}

/**
 * Scrim behind the dots. Photos are unpredictable — white dots vanish against a
 * bright sky — so the controls get their own contrast floor rather than relying
 * on the image. Non-interactive, or it would swallow swipes.
 */
function BottomScrim() {
  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.55)']}
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 }}
    />
  );
}

function Slides({
  media,
  width,
  height,
}: Readonly<{ media: PropertyCardMedia[]; width: number; height: number }>) {
  const listRef = useRef<FlatList<PropertyCardMedia>>(null);
  // A manual swipe or an explicit pause both stop the auto-advance; an
  // auto-advance that yanks the slide away mid-browse is what makes a carousel
  // feel uninteractive. Only the toggle can start it again.
  const [paused, setPaused] = useState(false);
  const hasVideo = media.some((item) => item.type === 'video');

  const { index, onViewableItemsChanged, viewabilityConfig } = useAutoSlide({
    count: media.length,
    width,
    intervalMs: AUTO_SLIDE_MS,
    listRef,
    // Videos need a stable slide to play on, so they disable auto-advance too.
    enabled: !paused && !hasVideo,
  });

  const renderItem = useCallback(
    ({ item, index: itemIndex }: { item: PropertyCardMedia; index: number }) =>
      item.type === 'video' ? (
        <CarouselVideoSlide
          url={item.url}
          width={width}
          height={height}
          isActive={itemIndex === index}
        />
      ) : (
        <Image source={{ uri: item.url }} style={{ width, height }} resizeMode="cover" />
      ),
    [width, height, index],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<PropertyCardMedia> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  return (
    <>
      <FlatList
        ref={listRef}
        data={media}
        keyExtractor={(item, i) => `${i}-${item.url}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setPaused(true)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        // No removeClippedSubviews: on horizontal lists it detaches cells that
        // are still on screen, producing blank and unresponsive slides.
        getItemLayout={getItemLayout}
        renderItem={renderItem}
      />
      {media.length > 1 ? <BottomScrim /> : null}
      <CarouselIndicator count={media.length} activeIndex={index} hasVideo={hasVideo} />
      {/* Autoplay only exists for multi-image cards; video cards never advance. */}
      {media.length > 1 && !hasVideo ? (
        <CarouselAutoplayToggle paused={paused} onToggle={() => setPaused((p) => !p)} />
      ) : null}
    </>
  );
}

function CarouselContent({
  media,
  width,
  height,
}: Readonly<{ media: PropertyCardMedia[]; width: number; height: number }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  if (media.length === 0) {
    return (
      <View className="h-full w-full items-center justify-center bg-muted">
        <Icon name="Building2" size={40} color={mutedFg} />
      </View>
    );
  }
  if (width === 0) {
    const [first] = media;
    // Pre-layout placeholder only; the video slide mounts once width is known.
    return first?.type === 'image' ? (
      <Image source={{ uri: first.url }} className="h-full w-full" resizeMode="cover" />
    ) : (
      <View className="h-full w-full bg-muted" />
    );
  }
  return <Slides media={media} width={width} height={height} />;
}

export function PropertyImageCarousel({ media, height, children }: Readonly<Props>) {
  const [width, setWidth] = useState(0);

  return (
    <View
      className="relative w-full overflow-hidden rounded-2xl bg-muted"
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <CarouselContent media={media} width={width} height={height} />
      {children}
    </View>
  );
}
