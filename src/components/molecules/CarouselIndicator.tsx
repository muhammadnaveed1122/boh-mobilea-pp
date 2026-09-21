import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

/**
 * Carousel position indicator that adapts to the media count.
 *
 * Listings routinely carry 10-12 photos, and a row of twelve pips reads as
 * noise on a card-sized image — the dots stop being countable and just add
 * clutter. So beyond a handful we switch to a compact "3 / 12" counter, which
 * stays legible at any length and tells the user how much is left. Dots remain
 * for small sets, where they're the more glanceable form.
 */
const MAX_DOTS = 5;

const OVERLAY_BG = 'rgba(0,0,0,0.55)';

const DOT_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const;

interface Props {
  count: number;
  activeIndex: number;
  /** Shows a video glyph on the counter when the set contains any video. */
  hasVideo?: boolean;
}

function Dots({ count, activeIndex }: Readonly<{ count: number; activeIndex: number }>) {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={`dot-${String(i)}`}
          style={DOT_SHADOW}
          className={`h-2 rounded-full ${i === activeIndex ? 'w-5 bg-white' : 'w-2 bg-white/70'}`}
        />
      ))}
    </View>
  );
}

function Counter({
  count,
  activeIndex,
  hasVideo,
}: Readonly<{ count: number; activeIndex: number; hasVideo: boolean }>) {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-2.5 right-2.5 flex-row items-center gap-1 rounded-full px-2 py-1"
      style={{ backgroundColor: OVERLAY_BG }}
    >
      <Icon name={hasVideo ? 'Video' : 'Images'} size={11} color="#FFFFFF" />
      <Text
        className="text-[11px] font-semibold text-white"
        // Tabular figures stop the pill resizing as the index ticks over.
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {activeIndex + 1}/{count}
      </Text>
    </View>
  );
}

export function CarouselIndicator({ count, activeIndex, hasVideo = false }: Readonly<Props>) {
  if (count <= 1) return null;
  if (count <= MAX_DOTS) {
    return <Dots count={count} activeIndex={activeIndex} />;
  }
  return <Counter count={count} activeIndex={activeIndex} hasVideo={hasVideo} />;
}
