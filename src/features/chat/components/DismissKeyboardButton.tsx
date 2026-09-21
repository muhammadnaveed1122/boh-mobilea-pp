import { Keyboard, Pressable } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/atoms/Icon';
import { useThemeColor } from '@theme';

/**
 * Bare dismiss-keyboard glyph, shown only while the OS keyboard is up. It is
 * positioned absolutely over the bottom-right of the message list rather than
 * stacked above the composer — a stacked row would paint the screen canvas
 * across the full width and read as a band instead of a floating button.
 */
export function DismissKeyboardButton() {
  const { isVisible } = useKeyboardState();
  const color = useThemeColor('--muted-foreground');
  if (!isVisible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      exiting={FadeOut.duration(100)}
      pointerEvents="box-none"
      className="absolute bottom-2 right-3"
    >
      <Pressable
        onPress={() => Keyboard.dismiss()}
        accessibilityRole="button"
        accessibilityLabel="Close keyboard"
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        className="h-9 w-9 items-center justify-center rounded-full"
      >
        <Icon name="KeyboardOff" size={22} color={color} />
      </Pressable>
    </Animated.View>
  );
}
