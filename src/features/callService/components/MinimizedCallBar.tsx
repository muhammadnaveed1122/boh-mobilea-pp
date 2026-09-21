/**
 * Floating in-call banner shown while the active-call screen is minimized
 * (WhatsApp/Telegram style). Renders above every route, displays the live call
 * timer + caller name, and reopens the full call screen on tap. The duration is
 * read straight from the store (ticked once-per-second by the global call-service
 * timer), so it keeps counting while minimized — independent of this banner.
 *
 * Layout: mute (left) · caller name + live timer (centre, tap to reopen) · hang
 * up (right). Touch targets are 44pt; the timer uses tabular figures so it does
 * not jiggle; status is conveyed by both colour AND an icon (not colour alone).
 *
 * Foreground-only: when the app is backgrounded/killed the OS call UI (CallKeep /
 * CallStyle notification) takes over instead.
 */

import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useCanViewLeadContact } from '@/features/leads/hooks/use-can-view-lead-contact';
import { maskPhone } from '@/lib/contact-mask';

import { CALL_STATUS_LABELS, CallStatus } from '../constants';
import { useCallLeadContext } from '../hooks/use-call-lead-context';
import type { ActiveCallState } from '../models';
import { formatDuration } from '../utils/format-duration';

const CONNECTED_ACCENT = '#34D399'; // emerald-400
const DANGER = '#FF3B30';

export interface MinimizedCallBarProps {
  activeCall: ActiveCallState;
  onExpand: () => void;
  onToggleMute: () => void;
  onHangup: () => void;
}

interface RoundButtonProps {
  icon: IconName;
  bg: string;
  iconColor?: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function RoundButton({
  icon,
  bg,
  iconColor = '#FFFFFF',
  accessibilityLabel,
  onPress,
}: Readonly<RoundButtonProps>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={iconColor} />
    </Pressable>
  );
}

export function MinimizedCallBar({
  activeCall,
  onExpand,
  onToggleMute,
  onHangup,
}: Readonly<MinimizedCallBarProps>) {
  const insets = useSafeAreaInsets();
  const ctx = useCallLeadContext(activeCall.contactId, activeCall.number);
  const canViewContact = useCanViewLeadContact();

  const rawNumber = activeCall.number;
  const displayNumber =
    rawNumber && !canViewContact ? (maskPhone(rawNumber) ?? rawNumber) : rawNumber;
  const title = ctx.displayName || activeCall.displayName || displayNumber || 'Unknown';
  const isConnected = activeCall.status === CallStatus.IN_CALL;
  const statusText = isConnected
    ? formatDuration(activeCall.duration)
    : CALL_STATUS_LABELS[activeCall.status];
  const isMuted = activeCall.isMuted;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 50 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 60,
          paddingHorizontal: 8,
          borderRadius: 30,
          backgroundColor: '#1B2430',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        {/* Left: mute toggle — filled when muted so state reads without colour */}
        <RoundButton
          icon={isMuted ? 'MicOff' : 'Mic'}
          bg={isMuted ? '#FFFFFF' : 'rgba(255,255,255,0.12)'}
          iconColor={isMuted ? '#111827' : '#FFFFFF'}
          accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
          onPress={onToggleMute}
        />

        {/* Centre: caller + live timer — tap to reopen the full call screen */}
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel={`Reopen call with ${title}`}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 2 }}
        >
          <Text className="text-[15px] font-semibold text-white" numberOfLines={1}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                marginRight: 6,
                backgroundColor: isConnected ? CONNECTED_ACCENT : 'rgba(255,255,255,0.45)',
              }}
            />
            <Text
              style={{
                fontSize: 13,
                color: isConnected ? CONNECTED_ACCENT : 'rgba(255,255,255,0.65)',
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {statusText}
            </Text>
          </View>
        </Pressable>

        {/* Right: hang up — clearly red, icon + colour */}
        <RoundButton icon="PhoneOff" bg={DANGER} accessibilityLabel="End call" onPress={onHangup} />
      </View>
    </View>
  );
}
