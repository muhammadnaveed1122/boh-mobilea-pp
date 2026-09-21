/**
 * Manual dialpad screen (expo-router route `/(app)/call/dialpad`). Standalone.
 *
 * The typed number is LOCAL component state — it deliberately does NOT write
 * to the global call store on every keystroke. Routing each tap through the
 * Zustand store would re-render the globally-mounted `CallProvider` brain on
 * every digit, which made typing extremely laggy. The number is handed to the
 * controller only when Call is pressed.
 *
 * Press feedback uses RN's native `Pressable` `pressed` state, NOT NativeWind
 * `active:` variants: `active:` makes NativeWind subscribe each Pressable's
 * interaction state and restyle all 12 keys per press, which stalled the
 * native UI thread and made typing lag.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

import { DIALER_VALIDATION, NUMPAD_BUTTONS } from '../constants';
import { getCallController } from '../services/call-controller';
import { validatePhoneNumber } from '../services/dialer-validation';
import { lightHaptic, successHaptic, tapHaptic } from '../services/haptics';

const KEY_SIZE = 72;

/**
 * The 12-key grid is fully static (`NUMPAD_BUTTONS` is a const). Memoized with
 * a stable `onDigit` so it renders ONCE and is skipped on every keystroke.
 */
const Numpad = memo(function Numpad({
  onDigit,
  onLongZero,
}: Readonly<{ onDigit: (digit: string) => void; onLongZero: () => void }>) {
  return (
    <View className="flex-row flex-wrap">
      {NUMPAD_BUTTONS.map(({ digit, letters }) => (
        <Pressable
          key={digit}
          onPress={() => onDigit(digit)}
          onLongPress={digit === '0' ? onLongZero : undefined}
          delayLongPress={300}
          className="w-1/3 items-center py-3"
          accessibilityLabel={digit === '0' ? 'Dial 0, hold for plus' : `Dial ${digit}`}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <View
            style={{
              width: KEY_SIZE,
              height: KEY_SIZE,
              borderRadius: KEY_SIZE / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '500', color: '#FFFFFF' }}>
              {digit}
            </Text>
            {letters ? (
              <Text
                style={{
                  fontSize: 10,
                  lineHeight: 14,
                  letterSpacing: 2,
                  color: 'rgba(255,255,255,0.45)',
                  marginTop: 1,
                }}
              >
                {letters}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
});

export function DialpadScreen() {
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');

  // State first, haptic after — the digit must paint immediately and never
  // wait on the native haptic call on the same tick.
  const addDigit = useCallback((digit: string) => {
    setPhoneNumber((prev) => (prev.length >= DIALER_VALIDATION.MAX_LENGTH ? prev : prev + digit));
    tapHaptic();
  }, []);
  // Long-press 0 → leading "+". Only valid as the first char; ignored otherwise.
  const addPlus = useCallback(() => {
    setPhoneNumber((prev) => (prev.length === 0 ? '+' : prev));
    successHaptic();
  }, []);
  const removeDigit = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
    lightHaptic();
  }, []);
  const clearAll = useCallback(() => {
    setPhoneNumber('');
    lightHaptic();
  }, []);

  const isValid = useMemo(() => validatePhoneNumber(phoneNumber), [phoneNumber]);

  return (
    <View className="flex-1 bg-[#0B1220]">
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Close dialer"
            className="h-10 w-10 items-center justify-center rounded-full"
            style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
          >
            <Icon name="X" size={22} color="#FFFFFF" />
          </Pressable>
          <Text className="text-base font-semibold text-white">Dialer</Text>
          <View className="w-10" />
        </View>

        <View className="mt-10 items-center">
          <Text
            style={{
              fontSize: 34,
              lineHeight: 42,
              fontWeight: '600',
              color: phoneNumber ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
              fontVariant: ['tabular-nums'],
              letterSpacing: 1,
            }}
            numberOfLines={1}
          >
            {phoneNumber || 'Enter number'}
          </Text>
        </View>

        <View className="mt-auto">
          <Numpad onDigit={addDigit} onLongZero={addPlus} />

          <View
            className="mt-4 flex-row items-center justify-center gap-10"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            <View className="w-16" />
            <Pressable
              disabled={!isValid}
              onPress={() => {
                successHaptic();
                getCallController().makeCall(phoneNumber);
                router.back();
              }}
              accessibilityLabel="Call"
              style={({ pressed }) => {
                let opacity = 1;
                if (!isValid) opacity = 0.4;
                else if (pressed) opacity = 0.8;
                return {
                  width: KEY_SIZE,
                  height: KEY_SIZE,
                  borderRadius: KEY_SIZE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#22C55E',
                  opacity,
                  shadowColor: '#22C55E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isValid ? 0.45 : 0,
                  shadowRadius: 12,
                  elevation: isValid ? 8 : 0,
                };
              }}
            >
              <Icon name="Phone" size={30} color="#FFFFFF" />
            </Pressable>
            <Pressable
              disabled={!phoneNumber}
              onPress={removeDigit}
              onLongPress={clearAll}
              accessibilityLabel="Backspace"
              className="w-16 items-center"
              style={({ pressed }) => {
                let opacity = 0.3;
                if (phoneNumber) opacity = pressed ? 0.6 : 1;
                return { opacity };
              }}
            >
              <Icon name="Delete" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
