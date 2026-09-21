import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import { formatClock } from '../utils/call-format';
import type { RecordingPlayer } from '../hooks/use-recording-player';

interface Props {
  uuid: string;
  player: RecordingPlayer;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

const THUMB = 14;
const SKIP_SECONDS = 10;

/**
 * Full playback transport for a single recording: play/pause, ±10s skip,
 * a draggable scrub bar, elapsed/total timers, and a speed cycle. Mounted only
 * for the recording the shared {@link RecordingPlayer} currently has loaded.
 */
export function AudioPlayer({ uuid, player }: Readonly<Props>) {
  const primary = useThemeColor('--primary');
  const primaryFg = useThemeColor('--primary-foreground');
  const muted = useThemeColor('--muted-foreground');

  const loading = player.loadingId === uuid;
  const playing = player.isPlaying;
  const { duration, position } = player;

  const onPlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    player.toggle(uuid);
  };

  return (
    <View className="gap-2">
      <Scrubber
        position={position}
        duration={duration}
        color={primary}
        track={muted}
        onSeek={player.seekTo}
      />

      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-[11px] text-muted-foreground">{formatClock(position)}</Text>
        <Text className="font-mono text-[11px] text-muted-foreground">
          {duration > 0 ? formatClock(duration) : '--:--'}
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        {/* Speed */}
        <Pressable
          onPress={player.cycleRate}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${String(player.rate)} times`}
          className={cn(
            'min-w-[52px] items-center rounded-full border px-3 py-2 active:opacity-70',
            player.rate === 1 ? 'border-border' : 'border-primary/40 bg-primary/10',
          )}
        >
          <Text
            className={cn(
              'text-xs font-semibold',
              player.rate === 1 ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {player.rate}×
          </Text>
        </Pressable>

        {/* Transport */}
        <View className="flex-row items-center gap-5">
          <Pressable
            onPress={() => player.seekBy(-SKIP_SECONDS)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Rewind ten seconds"
            className="active:opacity-60"
          >
            <Icon name="RotateCcw" size={22} color={muted} />
          </Pressable>

          <Pressable
            onPress={onPlayPause}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause recording' : 'Play recording'}
            className="h-14 w-14 items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: primary }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={primaryFg} />
            ) : (
              <Icon name={playing ? 'Pause' : 'Play'} size={24} color={primaryFg} />
            )}
          </Pressable>

          <Pressable
            onPress={() => player.seekBy(SKIP_SECONDS)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Forward ten seconds"
            className="active:opacity-60"
          >
            <Icon name="RotateCw" size={22} color={muted} />
          </Pressable>
        </View>

        {/* Close — unloads the clip and collapses back to the play trigger. */}
        <Pressable
          onPress={player.stop}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close player"
          className="min-w-[52px] flex-row items-center justify-end gap-1 active:opacity-60"
        >
          <Icon name="X" size={18} color={muted} />
        </Pressable>
      </View>

      {player.error ? (
        <Text className="text-center text-xs text-destructive">{player.error}</Text>
      ) : null}
    </View>
  );
}

interface ScrubberProps {
  position: number;
  duration: number;
  color: string;
  track: string;
  onSeek: (seconds: number) => void;
}

function Scrubber({ position, duration, color, track, onSeek }: Readonly<ScrubberProps>) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const scrubRef = useRef<number | null>(null);

  const progress = duration > 0 ? clamp(position / duration, 0, 1) : 0;
  const fraction = scrub ?? progress;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const set = (x: number) => {
    if (width <= 0) return;
    const f = clamp(x / width, 0, 1);
    scrubRef.current = f;
    setScrub(f);
  };

  const commit = () => {
    if (scrubRef.current !== null && duration > 0) onSeek(scrubRef.current * duration);
    scrubRef.current = null;
    setScrub(null);
  };

  // runOnJS(true): scrub math touches React state, so keep it off the UI thread.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => set(e.x))
    .onUpdate((e) => set(e.x))
    .onFinalize(commit);

  return (
    <GestureDetector gesture={pan}>
      {/* Tall padded hit area (>=44pt) around the thin visual track. */}
      <View className="justify-center py-3" onLayout={onLayout} accessibilityRole="adjustable">
        <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: track }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${fraction * 100}%`, backgroundColor: color }}
          />
        </View>
        <View
          className="absolute rounded-full shadow-card"
          style={{
            left: clamp(fraction * width - THUMB / 2, 0, Math.max(width - THUMB, 0)),
            height: THUMB,
            width: THUMB,
            backgroundColor: color,
          }}
        />
      </View>
    </GestureDetector>
  );
}
