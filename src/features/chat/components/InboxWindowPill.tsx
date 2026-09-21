/**
 * Inbox-row variant of the 24h WhatsApp window badge — green live `HH:MM`
 * while the window is open, red `Expired` once it closes.
 *
 * Unlike the conversation header's `WhatsappWindowTimer`, this has no
 * server-authoritative `withinWindow` flag to lean on: the list endpoint
 * returns `windowExpiresAt` per row but no per-row status, so expiry is derived
 * from the timestamp. That is display-only — actual send gating still happens
 * in the conversation screen against the server flag.
 */

import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useWindowCountdown } from '../hooks/use-window-countdown';

interface Props {
  /** Absolute ISO expiry (last inbound + 24h), or null when no inbound yet. */
  windowExpiresAt: string | null;
}

export function InboxWindowPill({ windowExpiresAt }: Readonly<Props>) {
  const { label, isExpired, hasWindow } = useWindowCountdown(windowExpiresAt);
  const success = useThemeColor('--success');
  const destructive = useThemeColor('--destructive');

  // No inbound message yet → nothing to count down, so no pill at all.
  if (!hasWindow) return null;

  return (
    <View
      className="flex-row items-center rounded-full px-2 py-0.5"
      style={{ backgroundColor: isExpired ? destructive : success }}
      accessibilityRole="text"
      accessibilityLabel={
        isExpired ? 'WhatsApp window expired' : `WhatsApp window closes in ${label}`
      }
    >
      <Icon name="Clock" size={11} color="#FFFFFF" />
      <Text className="ml-1 text-[11px] font-semibold text-white">
        {isExpired ? 'Expired' : label}
      </Text>
    </View>
  );
}
