import { useCallback, useRef, useState, type ReactNode } from 'react';
import { FlatList, Image, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { CarouselAutoplayToggle } from '@/components/molecules/CarouselAutoplayToggle';
import { useThemeColor } from '@theme';
import { useAutoSlide } from '../../hooks/use-auto-slide';
import { CarouselDots } from './CarouselDots';
import { useProjectCard } from './ProjectCardContext';

// Matches the Buy/Rent card image so all three tabs scroll at the same density.
const IMAGE_HEIGHT = 170;
const AUTO_SLIDE_MS = 3500;

interface Props {
  children?: ReactNode;
}

function CarouselContent({ width, images }: Readonly<{ width: number; images: string[] }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const listRef = useRef<FlatList<string>>(null);
  // A manual swipe or an explicit pause stops the auto-advance; advancing over
  // someone mid-browse is what makes a carousel feel like it ignores input.
  const [paused, setPaused] = useState(false);
  const { index, onViewableItemsChanged, viewabilityConfig } = useAutoSlide({
    count: images.length,
    width,
    intervalMs: AUTO_SLIDE_MS,
    listRef,
    enabled: !paused,
  });

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <Image source={{ uri: item }} style={{ width, height: IMAGE_HEIGHT }} resizeMode="cover" />
    ),
    [width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  if (images.length === 0) {
    return (
      <View className="h-full w-full items-center justify-center bg-muted">
        <Icon name="Building2" size={40} color={mutedFg} />
      </View>
    );
  }

  if (width === 0) {
    return <Image source={{ uri: images[0] }} className="h-full w-full" resizeMode="cover" />;
  }

  return (
    <>
      <FlatList
        ref={listRef}
        data={images}
        keyExtractor={(uri, i) => `${i}-${uri}`}
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
      <CarouselDots activeIndex={index} />
      {images.length > 1 ? (
        <CarouselAutoplayToggle paused={paused} onToggle={() => setPaused((p) => !p)} />
      ) : null}
    </>
  );
}

export function ProjectImageCarousel({ children }: Readonly<Props>) {
  const { images } = useProjectCard();
  const [width, setWidth] = useState(0);

  return (
    <View
      className="relative w-full overflow-hidden rounded-2xl bg-muted"
      style={{ height: IMAGE_HEIGHT }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <CarouselContent width={width} images={images} />
      {children}
    </View>
  );
}
