/**
 * Floating quick-reaction picker. Triggered on bubble long-press. Renders
 * through the global `<PortalHost />` so it can paint above the keyboard,
 * the message list, and the composer. Coordinates come from the gesture's
 * `absoluteX/absoluteY`; the menu is clamped to the screen and centered
 * above the touch point.
 */

import { useMemo } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Portal } from '@rn-primitives/portal';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor, useThemeColorAlpha } from '@theme';

const QUICK_EMOJI: string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const PILL_WIDTH = 280;
const PILL_HEIGHT = 48;
const VERTICAL_GAP = 12;

interface Props {
  visible: boolean;
  anchor: { x: number; y: number } | null;
  myCurrent?: string;
  onPick: (emoji: string) => void;
  onOpenSheet: () => void;
  onClose: () => void;
}

export function ReactionPickerMenu({
  visible,
  anchor,
  myCurrent,
  onPick,
  onOpenSheet,
  onClose,
}: Readonly<Props>) {
  const card = useThemeColor('--card');
  const border = useThemeColor('--border');
  const accentSoft = useThemeColorAlpha('--primary', 0.22);

  const position = useMemo(() => {
    if (!anchor) return { left: 0, top: 0 };
    const screen = Dimensions.get('window');
    const left = Math.max(8, Math.min(anchor.x - PILL_WIDTH / 2, screen.width - PILL_WIDTH - 8));
    let top = anchor.y - PILL_HEIGHT - VERTICAL_GAP;
    if (top < 64) {
      top = anchor.y + VERTICAL_GAP;
    }
    return { left, top };
  }, [anchor]);

  if (!visible || !anchor) return null;

  return (
    <Portal name="reactions-picker">
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss reaction picker"
        style={{ position: 'absolute', inset: 0 }}
      />
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(100)}
        style={{
          position: 'absolute',
          left: position.left,
          top: position.top,
          width: PILL_WIDTH,
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: card,
          borderWidth: 1,
          borderColor: border,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View className="h-full flex-row items-center justify-around px-2">
          {QUICK_EMOJI.map((emoji) => {
            const isMine = myCurrent === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => onPick(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                hitSlop={4}
                className={cn('h-9 w-9 items-center justify-center rounded-full active:opacity-60')}
                style={isMine ? { backgroundColor: accentSoft } : undefined}
              >
                <Text className="text-[22px]">{emoji}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onOpenSheet}
            accessibilityRole="button"
            accessibilityLabel="Open full emoji picker"
            hitSlop={4}
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
          >
            <Icon name="Plus" size={20} />
          </Pressable>
        </View>
      </Animated.View>
    </Portal>
  );
}
