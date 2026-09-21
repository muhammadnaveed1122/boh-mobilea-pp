/**
 * Full-screen incoming-call UI. Rendered by CallProvider over any route while
 * the app is foregrounded and the SIP socket is alive.
 */

import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { maskPhone } from '@/lib/contact-mask';

import { useCanViewLeadContact } from '../../leads/hooks/use-can-view-lead-contact';
import { useCallLeadContext } from '../hooks/use-call-lead-context';
import type { IncomingCall } from '../models';
import { GradientAvatar } from './GradientAvatar';

export interface IncomingCallScreenProps {
  incomingCall: IncomingCall;
  onAnswer: () => void;
  onDecline: () => void;
}

const RING_BASE = 144;

function PulseRing({ delay }: Readonly<{ delay: number }>) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.55 }],
    opacity: 0.45 * (1 - progress.value),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: RING_BASE,
          height: RING_BASE,
          borderRadius: RING_BASE / 2,
          borderWidth: 2,
          borderColor: '#6366F1',
        },
        animated,
      ]}
    />
  );
}

export function IncomingCallScreen({
  incomingCall,
  onAnswer,
  onDecline,
}: Readonly<IncomingCallScreenProps>) {
  // Match the lead-card / active-call rule 1:1 — admin sees the raw number,
  // everyone else (agents) sees it masked on the incoming screen too.
  const canViewContact = useCanViewLeadContact();
  const displayNumber =
    incomingCall.number && !canViewContact
      ? (maskPhone(incomingCall.number) ?? incomingCall.number)
      : incomingCall.number;
  const fallbackName = incomingCall.displayName || displayNumber || 'Unknown';
  const ctx = useCallLeadContext(null, incomingCall.number);
  const title = ctx.displayName || fallbackName;

  return (
    <View className="flex-1 bg-[#0B1220]">
      <View className="flex-1 items-center justify-between px-6 pb-16 pt-28">
        <View className="items-center">
          <Text className="text-xs uppercase tracking-[0.3em] text-white/50">Incoming call</Text>

          <View className="mt-10 h-36 w-36 items-center justify-center">
            <PulseRing delay={0} />
            <PulseRing delay={900} />
            <GradientAvatar name={title} size={112} />
          </View>

          <Text className="mt-7 text-3xl font-semibold tracking-tight text-white" numberOfLines={1}>
            {title}
          </Text>
          {displayNumber ? (
            <Text className="mt-1 text-base text-white/55">{displayNumber}</Text>
          ) : null}

          {ctx.chips.length > 0 ? (
            <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
              {ctx.chips.map((chip) => (
                <View
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5"
                >
                  <Text className="text-xs text-white/85">{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View className="w-full flex-row justify-around">
          <View className="items-center">
            <Pressable
              onPress={onDecline}
              accessibilityLabel="Decline call"
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
            <Text className="mt-3 text-xs text-white/70">Decline</Text>
          </View>
          <View className="items-center">
            <Pressable
              onPress={onAnswer}
              accessibilityLabel="Answer call"
              style={({ pressed }) => ({
                width: 72,
                height: 72,
                borderRadius: 36,
                opacity: pressed ? 0.8 : 1,
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.45,
                shadowRadius: 12,
                elevation: 8,
              })}
            >
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
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
                <Icon name="Phone" size={30} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <Text className="mt-3 text-xs text-white/70">Accept</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
