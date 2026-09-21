/**
 * Floating action for the inbox: start a new conversation. Always visible —
 * no hide-on-scroll, so the button sits in the same place whatever the list is
 * doing. The dialer button lives on the call logs screen (`DialerFab`).
 *
 * Styling follows the shape the rest of the app already uses for floating
 * buttons: sizing, radius, background and press feedback via Tailwind classes,
 * and only the computed bits (safe-area offset, shadow) via an object-form
 * `style`. Passing a function-form `style` alongside `className` broke the
 * class-derived layout here, so keep the style object plain.
 *
 * Icon colours use the `-foreground` token paired with the background token,
 * never a hardcoded white — in dark mode `--primary` is near-white, so a white
 * glyph on it is invisible.
 */

import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/atoms/Icon';
import { BOTTOM_TAB_BAR_HEIGHT } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';

interface Props {
  /** Shows the new-conversation button. Hidden for shared-number agents. */
  showNewChat: boolean;
  onNewChat: () => void;
}

/** Breathing room between the button and the tab bar below it. */
const GAP_ABOVE_TAB_BAR = 20;
const EDGE_INSET = 20;

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

export function InboxFabStack({ showNewChat, onNewChat }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const primaryForeground = useThemeColor('--primary-foreground');

  if (!showNewChat) return null;

  // The tab bar is absolutely positioned over the screen, so the button must
  // clear its full height (bar + safe-area inset) rather than the inset alone.
  const bottom = insets.bottom + BOTTOM_TAB_BAR_HEIGHT + GAP_ABOVE_TAB_BAR;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: EDGE_INSET,
        bottom,
        alignItems: 'flex-end',
        gap: 12,
      }}
    >
      <Pressable
        onPress={onNewChat}
        accessibilityRole="button"
        accessibilityLabel="New conversation"
        className="h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-80"
        style={SHADOW}
      >
        <Icon name="MessageSquarePlus" size={24} color={primaryForeground} />
      </Pressable>
    </View>
  );
}
