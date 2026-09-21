import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useWindowCountdown } from '../hooks/use-window-countdown';

interface Props {
  /** Absolute ISO expiry (last inbound + 24h), or null when no inbound yet. */
  windowExpiresAt: string | null;
  /** Server-authoritative window flag. `undefined` while loading. */
  withinWindow: boolean | undefined;
}

/**
 * Pill badge showing the live 24h WhatsApp window countdown. Green `HH:MM`
 * while the window is open, red `Expired` once it closes. Renders nothing when
 * there is no window to count down (no inbound message yet) or while the
 * window status is still loading.
 */
export function WhatsappWindowTimer({ windowExpiresAt, withinWindow }: Readonly<Props>) {
  const { label, hasWindow } = useWindowCountdown(windowExpiresAt);
  const successColor = useThemeColor('--success');
  const destructiveColor = useThemeColor('--destructive');

  if (!hasWindow || withinWindow === undefined) return null;

  const active = withinWindow;
  const bg = active ? successColor : destructiveColor;

  return (
    <View
      className="flex-row items-center rounded-full px-2.5 py-1"
      style={{ backgroundColor: bg }}
      accessibilityRole="text"
      accessibilityLabel={active ? `Window closes in ${label}` : 'WhatsApp window expired'}
    >
      <Icon name="Clock" size={12} color="#FFFFFF" />
      <Text className="ml-1 text-[11px] font-semibold text-white">
        {active ? label : 'Expired'}
      </Text>
    </View>
  );
}
