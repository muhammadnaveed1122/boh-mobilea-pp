import { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';

/**
 * Reusable shimmer placeholder. Soft opacity-pulse via Animated.loop on the
 * native driver — same technique as LeadDetailSkeleton, extracted as an atom.
 * Compose multiple <Skeleton> blocks to build a loading layout.
 */
export function Skeleton({ className, style, ...props }: Readonly<ViewProps>) {
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
    <Animated.View
      className={cn('rounded bg-muted', className)}
      style={[{ opacity }, style]}
      {...props}
    />
  );
}
