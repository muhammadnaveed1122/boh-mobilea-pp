/**
 * Full-screen in-call UI with a bottom swipe-up sheet for live notes.
 * Duration, lead-context chips, and the notes sheet are layered on top of the
 * existing brain handlers (no behavioural changes — only the visual shell).
 */

import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useCanViewLeadContact } from '@/features/leads/hooks/use-can-view-lead-contact';
import { maskPhone } from '@/lib/contact-mask';

import {
  AUDIO_ROUTE_LABELS,
  AudioRoute,
  CALL_STATUS_LABELS,
  CallStatus,
  NUMPAD_BUTTONS,
} from '../constants';
import { useCallLeadContext } from '../hooks/use-call-lead-context';
import type { ActiveCallState } from '../models';
import type { AudioRouteState } from '../services/call-audio';
import { CALL_END_REASON_LABELS } from '../services/call-end-reason';
import { formatDuration } from '../utils/format-duration';
import { CallNotesSheet, type CallNotesSheetHandle } from './CallNotesSheet';
import { GradientAvatar } from './GradientAvatar';

/** Masks the dialed number unless the viewer may see raw lead contact (admin). */
function resolveDisplayNumber(number: string | null | undefined, canViewContact: boolean) {
  if (!number) return number;
  if (canViewContact) return number;
  return maskPhone(number) ?? number;
}

/** Translucent white used for inactive control-button backgrounds. */
const SUBTLE_BG = 'rgba(255,255,255,0.12)';

const ROUTE_ICONS: Record<AudioRoute, IconName> = {
  [AudioRoute.EARPIECE]: 'Phone',
  [AudioRoute.SPEAKER_PHONE]: 'Volume2',
  [AudioRoute.BLUETOOTH]: 'Bluetooth',
  [AudioRoute.WIRED_HEADSET]: 'Headphones',
};

function ChipRow({ chips }: Readonly<{ chips: string[] }>) {
  if (chips.length === 0) return null;
  return (
    <View className="mt-4 flex-row flex-wrap items-center justify-center">
      {chips.map((chip) => (
        <View
          key={chip}
          className="mb-2 mr-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1"
        >
          <Text className="text-[11px] text-white/85">{chip}</Text>
        </View>
      ))}
    </View>
  );
}

interface ControlButtonProps {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}

function ControlButton({ icon, label, active, onPress }: Readonly<ControlButtonProps>) {
  return (
    <Pressable
      onPress={onPress}
      className="w-1/3 items-center py-3"
      accessibilityLabel={label}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? '#FFFFFF' : SUBTLE_BG,
        }}
      >
        <Icon name={icon} size={26} color={active ? '#101827' : '#FFFFFF'} />
      </View>
      <Text className="mt-2 text-xs text-white/80">{label}</Text>
    </Pressable>
  );
}

/**
 * Audio-output control — one JS control on both platforms. Tapping opens a
 * sheet of the routes the native layer reports; with only earpiece+speaker
 * available it acts as a plain speaker toggle.
 *
 * iOS used to render the system `AVRoutePickerView` here. That sheet changes
 * the route without telling JS, so when CallKit / the WebRTC audio unit re-set
 * the session category at connect time and cancelled the override, nothing knew
 * what to restore. Routing now goes through `modules/audio-route`, which both
 * forces the port and reports every change back (see services/call-audio.ts).
 */
function AudioRouteControl({
  audioRoute,
  onSelectAudioRoute,
}: Readonly<{
  audioRoute: AudioRouteState;
  onSelectAudioRoute: (route: AudioRoute) => void;
}>) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { selected, available } = audioRoute;
  const activeIcon = ROUTE_ICONS[selected] ?? 'Volume2';
  const isSpeakerLike = selected === AudioRoute.SPEAKER_PHONE;

  // 2 routes → toggle earpiece/speaker; 3+ → open the picker sheet.
  const onPress = () => {
    if (available.length > 2) {
      setSheetOpen(true);
      return;
    }
    onSelectAudioRoute(isSpeakerLike ? AudioRoute.EARPIECE : AudioRoute.SPEAKER_PHONE);
  };

  return (
    <>
      <ControlButton
        icon={activeIcon}
        label={available.length > 2 ? AUDIO_ROUTE_LABELS[selected] : 'Speaker'}
        active={selected !== AudioRoute.EARPIECE}
        onPress={onPress}
      />
      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setSheetOpen(false)}>
          <View className="rounded-t-3xl bg-[#1B2A4E] px-4 pb-10 pt-3">
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-white/25" />
            <Text className="mb-1 px-3 py-2 text-sm font-semibold text-white/60">Audio output</Text>
            {available.map((route) => {
              const isActive = route === selected;
              return (
                <Pressable
                  key={route}
                  onPress={() => {
                    onSelectAudioRoute(route);
                    setSheetOpen(false);
                  }}
                  className="flex-row items-center rounded-2xl px-3 py-4"
                  style={({ pressed }) =>
                    pressed ? { backgroundColor: 'rgba(255,255,255,0.06)' } : null
                  }
                  accessibilityLabel={AUDIO_ROUTE_LABELS[route]}
                >
                  <Icon name={ROUTE_ICONS[route]} size={22} color="#FFFFFF" />
                  <Text className="ml-4 flex-1 text-base text-white">
                    {AUDIO_ROUTE_LABELS[route]}
                  </Text>
                  {isActive ? <Icon name="Check" size={20} color="#60A5FA" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface CallControlsProps {
  keypadOpen: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  audioRoute: AudioRouteState;
  onSendDtmf: (digit: string) => void;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSelectAudioRoute: (route: AudioRoute) => void;
  onToggleKeypad: () => void;
  onHangup: () => void;
  onOpenNotes: () => void;
}

/** Bottom control cluster (keypad / mute / hold / audio / end / notes). */
function CallControls({
  keypadOpen,
  isMuted,
  isOnHold,
  audioRoute,
  onSendDtmf,
  onToggleMute,
  onToggleHold,
  onSelectAudioRoute,
  onToggleKeypad,
  onHangup,
  onOpenNotes,
}: Readonly<CallControlsProps>) {
  return (
    <View className="mt-auto">
      {keypadOpen ? (
        <View className="w-full flex-row flex-wrap">
          {NUMPAD_BUTTONS.map(({ digit }) => (
            <Pressable
              key={digit}
              onPress={() => onSendDtmf(digit)}
              className="w-1/3 items-center py-3"
              accessibilityLabel={`Send ${digit}`}
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
            >
              <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <Text className="text-2xl font-semibold text-white">{digit}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="w-full flex-row flex-wrap justify-center">
          <ControlButton
            icon={isMuted ? 'MicOff' : 'Mic'}
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            onPress={onToggleMute}
          />
          <ControlButton
            icon={isOnHold ? 'Play' : 'Pause'}
            label={isOnHold ? 'Resume' : 'Hold'}
            active={isOnHold}
            onPress={onToggleHold}
          />
          <AudioRouteControl audioRoute={audioRoute} onSelectAudioRoute={onSelectAudioRoute} />
        </View>
      )}

      <View className="mt-6 flex-row items-center justify-around">
        <Pressable
          onPress={onToggleKeypad}
          accessibilityLabel="Toggle keypad"
          className="items-center"
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: keypadOpen ? '#FFFFFF' : SUBTLE_BG,
            }}
          >
            <Icon name="Grid2x2" size={22} color={keypadOpen ? '#101827' : '#FFFFFF'} />
          </View>
          <Text className="mt-2 text-[11px] text-white/65">Keypad</Text>
        </Pressable>

        <View className="items-center">
          <Pressable
            onPress={onHangup}
            accessibilityLabel="End call"
            style={({ pressed }) => ({
              width: 72,
              height: 72,
              borderRadius: 36,
              opacity: pressed ? 0.8 : 1,
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 8,
            })}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="PhoneOff" size={30} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <Text className="mt-2 text-[11px] font-medium text-white/85">End</Text>
        </View>

        <Pressable
          onPress={onOpenNotes}
          accessibilityLabel="Open live notes"
          className="items-center"
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: SUBTLE_BG,
            }}
          >
            <Icon name="NotebookPen" size={22} color="#FFFFFF" />
          </View>
          <Text className="mt-2 text-[11px] text-white/65">Notes</Text>
        </Pressable>
      </View>
    </View>
  );
}

export interface ActiveCallScreenProps {
  activeCall: ActiveCallState;
  audioRoute: AudioRouteState;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSelectAudioRoute: (route: AudioRoute) => void;
  onSendDtmf: (digit: string) => void;
  onHangup: () => void;
  onMinimize: () => void;
  /**
   * Top safe-area inset measured by CallProvider (which lives under the root
   * SafeAreaProvider). Passed in because `useSafeAreaInsets()` inside this
   * full-screen Modal's separate window reports 0, which would tuck the
   * minimize button under the notch / Dynamic Island.
   */
  topInset?: number;
}

export function ActiveCallScreen({
  activeCall,
  audioRoute,
  onToggleMute,
  onToggleHold,
  onSelectAudioRoute,
  onSendDtmf,
  onHangup,
  onMinimize,
  topInset,
}: Readonly<ActiveCallScreenProps>) {
  const insets = useSafeAreaInsets();
  // insets.top resolves to 0 inside the full-screen Modal; topInset is measured
  // by CallProvider under the root provider. Floor clears the notch/Island.
  const safeTop = Math.max(topInset ?? insets.top, 50);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const sheetRef = useRef<CallNotesSheetHandle>(null);

  const ctx = useCallLeadContext(activeCall.contactId, activeCall.number);
  // Match the lead-card rule 1:1 — admin sees the raw number, everyone else
  // (agents) sees it masked on the call screen too.
  const canViewContact = useCanViewLeadContact();
  const displayNumber = resolveDisplayNumber(activeCall.number, canViewContact);
  const title = ctx.displayName || activeCall.displayName || displayNumber || 'Unknown';
  const isConnected = activeCall.status === CallStatus.IN_CALL;
  // Post-call window: status is terminal and endReason is set. Show the reason
  // and drop the in-call controls (mute/hold/keypad/end) — the card auto-closes.
  const isEnded = activeCall.endReason != null;
  const statusLabel = isEnded
    ? CALL_END_REASON_LABELS[activeCall.endReason!]
    : CALL_STATUS_LABELS[activeCall.status];

  const noteKey = useMemo(() => {
    if (ctx.leadId) return ctx.leadId;
    if (activeCall.contactId) return activeCall.contactId;
    if (activeCall.number) return `__cold_${activeCall.number}__`;
    return '__cold_unknown__';
  }, [ctx.leadId, activeCall.contactId, activeCall.number]);

  const openNotes = () => {
    if (keypadOpen) setKeypadOpen(false);
    sheetRef.current?.expand();
  };

  const toggleKeypad = () => {
    setKeypadOpen((v) => {
      const next = !v;
      if (next) sheetRef.current?.collapse();
      return next;
    });
  };

  return (
    <View className="flex-1 bg-[#0B1220]">
      <View
        className="flex-1 px-6"
        style={{ paddingTop: safeTop, paddingBottom: insets.bottom + 96 }}
      >
        {/* Header row — minimize sits top-left like WhatsApp/Telegram. Kept in
            normal flex flow (not absolute) so it can never be clipped by the
            full-screen Modal / overlay stacking. */}
        <View className="h-11 flex-row items-center">
          <Pressable
            onPress={onMinimize}
            accessibilityLabel="Minimize call"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: SUBTLE_BG,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="Minimize2" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View className="mt-6 items-center">
          <GradientAvatar name={title} size={96} />
          <Text className="mt-5 text-2xl font-semibold tracking-tight text-white" numberOfLines={1}>
            {title}
          </Text>
          {displayNumber && title !== displayNumber ? (
            <Text className="mt-1 text-sm text-white/55">{displayNumber}</Text>
          ) : null}

          <Text
            style={{
              marginTop: 14,
              fontSize: 30,
              lineHeight: 38,
              fontWeight: '600',
              color: isConnected ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              fontVariant: ['tabular-nums'],
              letterSpacing: 1,
            }}
          >
            {isConnected ? formatDuration(activeCall.duration) : statusLabel}
          </Text>

          <ChipRow chips={ctx.chips} />
        </View>

        {isEnded ? null : (
          <CallControls
            keypadOpen={keypadOpen}
            isMuted={activeCall.isMuted}
            isOnHold={activeCall.isOnHold}
            audioRoute={audioRoute}
            onSendDtmf={onSendDtmf}
            onToggleMute={onToggleMute}
            onToggleHold={onToggleHold}
            onSelectAudioRoute={onSelectAudioRoute}
            onToggleKeypad={toggleKeypad}
            onHangup={onHangup}
            onOpenNotes={openNotes}
          />
        )}
      </View>

      <CallNotesSheet ref={sheetRef} noteKey={noteKey} />
    </View>
  );
}
