import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

function fmt(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// v1 limitations (tracked for follow-up):
// - One native player is created per mounted bubble; MessageList is a ScrollView
//   (no virtualization), so conversations with many voice notes hold many idle
//   players. Acceptable for typical volumes; revisit with lazy-on-first-play if needed.
// - No global "stop others" — multiple voice notes can play at once. A shared
//   audio coordinator can pause the previous player on play in a later pass.
export function AudioMessage({ url, tint }: Readonly<{ url: string; tint: string }>) {
  const source = useMemo(() => ({ uri: url }), [url]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const primaryFg = useThemeColor('--primary-foreground');

  const toggle = (): void => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= status.duration) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const remaining = status.duration > 0 ? status.duration - status.currentTime : 0;

  return (
    <View
      className="flex-row items-center rounded-xl bg-background/40 p-2.5"
      style={{ minWidth: 180 }}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
      >
        <Icon name={status.playing ? 'Pause' : 'Play'} size={16} color={primaryFg} />
      </Pressable>
      <View className="ml-3 flex-1">
        <View className="h-1 w-full rounded-full bg-muted">
          <View
            className="h-1 rounded-full"
            style={{
              backgroundColor: tint,
              width:
                status.duration > 0 ? `${(status.currentTime / status.duration) * 100}%` : '0%',
            }}
          />
        </View>
        <Text className="mt-1 text-xs text-muted-foreground">{fmt(remaining)}</Text>
      </View>
    </View>
  );
}
