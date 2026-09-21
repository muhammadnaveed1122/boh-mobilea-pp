/**
 * Compact pill row sitting BELOW a message bubble (WhatsApp pattern). One
 * pill per emoji; tapping toggles the caller's reaction (same emoji removes,
 * different emoji is set via the picker — not this bar). Aligned to match
 * the bubble's edge so it visually attaches to the bottom corner.
 */

import { Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/atoms/Text';
import { useThemeColorAlpha } from '@theme';

import { CHANNEL_META, type Channel } from '../models/channel';
import type { ReactionAggregate } from '../models/message';

interface Props {
  reactions: ReactionAggregate[];
  channel: Channel;
  isOut: boolean;
  onToggle: (emoji: string) => void;
}

export function ReactionBar({ reactions, channel, isOut, onToggle }: Readonly<Props>) {
  const meta = CHANNEL_META[channel];
  const minePillBg = useThemeColorAlpha(meta.accentToken, 0.35);
  const otherPillBg = useThemeColorAlpha('--foreground', 0.08);
  if (reactions.length === 0) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="-mt-1.5 flex-row flex-wrap gap-1"
      style={{ alignSelf: isOut ? 'flex-end' : 'flex-start', maxWidth: '82%' }}
    >
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => onToggle(r.emoji)}
          accessibilityRole="button"
          accessibilityLabel={`${r.emoji} ${r.count}, ${r.mine ? 'yours' : 'tap to add'}`}
          className="flex-row items-center rounded-full px-2 py-0.5 active:opacity-70"
          style={{ backgroundColor: r.mine ? minePillBg : otherPillBg }}
        >
          <Text className="text-[13px]">{r.emoji}</Text>
          {r.count > 1 ? (
            <Text className="ml-1 text-[11px] font-medium text-foreground">{r.count}</Text>
          ) : null}
        </Pressable>
      ))}
    </Animated.View>
  );
}
