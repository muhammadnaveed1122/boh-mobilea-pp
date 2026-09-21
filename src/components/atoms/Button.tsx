import * as React from 'react';
import { Animated, Easing, Pressable, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { TextClassContext } from './Text';
import { useThemeColor } from '@theme';

function normalizeRgb(value: string): string {
  const match = /rgb\(([^)]+)\)/i.exec(value);
  if (!match) return value;
  const parts = match[1].split(/[\s,]+/).filter(Boolean);
  return `rgb(${parts.join(', ')})`;
}

const buttonVariants = cva(
  'group flex-row items-center justify-center rounded-lg gap-2 overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border border-input bg-background',
        secondary: 'bg-secondary',
        ghost: '',
        link: '',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-12 rounded-lg px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const buttonTextVariants = cva('text-base font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline-offset-4',
    },
    size: {
      default: '',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface ButtonProps extends PressableProps, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
}

const BAR_WIDTH = 3;
const BAR_GAP = 4;
const BAR_MIN_HEIGHT = 6;
const BAR_MAX_HEIGHT = 18;
const BAR_PERIOD = 720;
const BAR_DELAYS = [0, 90, 180, 270];

function EqualizerBar({ delay, color }: Readonly<{ delay: number; color: string }>) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: BAR_PERIOD / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: BAR_PERIOD / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const timeout = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timeout);
      loop.stop();
    };
  }, [delay, progress]);

  const scaleY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [BAR_MIN_HEIGHT / BAR_MAX_HEIGHT, 1],
  });

  return (
    <Animated.View
      style={{
        width: BAR_WIDTH,
        height: BAR_MAX_HEIGHT,
        borderRadius: BAR_WIDTH / 2,
        backgroundColor: color,
        transform: [{ scaleY }],
      }}
    />
  );
}

export const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      disabled,
      loading,
      loadingLabel,
      children,
      onPressIn,
      onPressOut,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const resolvedVariant = variant ?? 'default';
    const primaryFg = useThemeColor('--primary-foreground');
    const fg = useThemeColor('--foreground');
    const indicatorColor = normalizeRgb(
      resolvedVariant === 'default' || resolvedVariant === 'destructive' ? primaryFg : fg,
    );

    const contentOpacity = React.useRef(new Animated.Value(loading ? 0 : 1)).current;
    const spinnerOpacity = React.useRef(new Animated.Value(loading ? 1 : 0)).current;
    const pressScale = React.useRef(new Animated.Value(1)).current;
    const [showSpinner, setShowSpinner] = React.useState(!!loading);

    React.useEffect(() => {
      if (loading) setShowSpinner(true);
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: loading ? 0 : 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(spinnerOpacity, {
          toValue: loading ? 1 : 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !loading) setShowSpinner(false);
      });
    }, [loading, contentOpacity, spinnerOpacity]);

    const handlePressIn = (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      Animated.timing(pressScale, {
        toValue: 0.97,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      onPressIn?.(e);
    };

    const handlePressOut = (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      Animated.timing(pressScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      onPressOut?.(e);
    };

    return (
      <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
        <AnimatedPressable
          ref={ref}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
          accessibilityLabel={loading ? (loadingLabel ?? 'Loading') : undefined}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={cn(buttonVariants({ variant, size }), className)}
          style={{
            transform: [{ scale: pressScale }],
            opacity: isDisabled ? 0.5 : 1,
          }}
          {...props}
        >
          <Animated.View
            style={{
              opacity: contentOpacity,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            pointerEvents={loading ? 'none' : 'auto'}
          >
            {children as React.ReactNode}
          </Animated.View>

          {showSpinner ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: BAR_GAP,
                opacity: spinnerOpacity,
              }}
            >
              {BAR_DELAYS.map((d) => (
                <EqualizerBar key={`bar-${d}`} delay={d} color={indicatorColor} />
              ))}
            </Animated.View>
          ) : null}
        </AnimatedPressable>
      </TextClassContext.Provider>
    );
  },
);
Button.displayName = 'Button';

export { buttonTextVariants, buttonVariants };
