/**
 * LeadDetailSkeleton — animated placeholder shown while `useLeadDetail` is
 * loading. Mimics the hero card + two stacked detail cards with a soft
 * opacity-pulse via `Animated.loop` (driven on the native side).
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

interface PulseProps {
  className: string;
  opacity: Animated.Value;
}

function Pulse({ className, opacity }: Readonly<PulseProps>) {
  return <Animated.View className={className} style={{ opacity }} />;
}

export function LeadDetailSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return (
    <View accessibilityLabel="Loading lead details" className="px-4 pt-2">
      {/* Hero placeholder */}
      <Pulse className="h-32 rounded-2xl bg-muted" opacity={opacity} />

      {/* Tab bar placeholder */}
      <Pulse className="mt-4 h-10 rounded-full bg-muted" opacity={opacity} />

      {/* Card 1 placeholder */}
      <View className="mt-4 rounded-2xl bg-card p-4">
        <Pulse className="h-5 w-1/3 rounded bg-muted" opacity={opacity} />
        <Pulse className="mt-4 h-4 w-full rounded bg-muted" opacity={opacity} />
        <Pulse className="mt-2 h-4 w-3/4 rounded bg-muted" opacity={opacity} />
        <Pulse className="mt-2 h-4 w-1/2 rounded bg-muted" opacity={opacity} />
      </View>

      {/* Card 2 placeholder */}
      <View className="mt-4 rounded-2xl bg-card p-4">
        <Pulse className="h-5 w-1/3 rounded bg-muted" opacity={opacity} />
        <Pulse className="mt-4 h-4 w-full rounded bg-muted" opacity={opacity} />
        <Pulse className="mt-2 h-4 w-2/3 rounded bg-muted" opacity={opacity} />
      </View>
    </View>
  );
}
