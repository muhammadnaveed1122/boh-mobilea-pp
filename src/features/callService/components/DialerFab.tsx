/**
 * Floating dialer button. Lives on the call logs screen — the natural home for
 * "place a call" next to the record of past calls.
 *
 * Always visible while the screen is: no hide-on-scroll. Reserve
 * `DIALER_FAB_SPACE` worth of extra bottom padding in the list under it so the
 * last row is never covered.
 *
 * Styling follows the shape the rest of the app uses for floating buttons:
 * sizing, radius, background and press feedback via Tailwind classes, and only
 * the computed bits (safe-area offset, shadow) via an object-form `style`.
 * Passing a function-form `style` alongside `className` breaks the
 * class-derived layout here, so keep the style object plain.
 *
 * The icon colour uses the `-foreground` token paired with the background
 * token, never a hardcoded white — in dark mode `--brand` is light, so a white
 * glyph on it is invisible.
 */

import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Icon } from '@/components/atoms/Icon';
import { BOTTOM_TAB_BAR_HEIGHT } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';

import { useCanDial } from '../hooks/use-can-dial';

/** Breathing room between the button and the tab bar below it. */
const GAP_ABOVE_TAB_BAR = 20;
const EDGE_INSET = 20;
const SIZE = 56;

/** Bottom padding a scrolling list needs so the button never covers a row. */
export const DIALER_FAB_SPACE = SIZE + GAP_ABOVE_TAB_BAR;

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

export function DialerFab() {
  const insets = useSafeAreaInsets();
  const brandForeground = useThemeColor('--brand-foreground');
  const canDial = useCanDial();

  if (!canDial) return null;

  // The tab bar is absolutely positioned over the screen, so the button must
  // clear its full height (bar + safe-area inset) rather than the inset alone.
  const bottom = insets.bottom + BOTTOM_TAB_BAR_HEIGHT + GAP_ABOVE_TAB_BAR;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: EDGE_INSET, bottom, alignItems: 'flex-end' }}
    >
      <Pressable
        onPress={() => router.push('/(app)/call/dialpad')}
        accessibilityRole="button"
        accessibilityLabel="Open dialer"
        className="h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-80"
        style={SHADOW}
      >
        <Icon name="Phone" size={24} color={brandForeground} />
      </Pressable>
    </View>
  );
}
