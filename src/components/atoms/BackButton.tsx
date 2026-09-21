import { Pressable, type PressableProps } from 'react-native';
import { router } from 'expo-router';
import { Icon } from './Icon';
import { cn } from '@/lib/utils';

export interface BackButtonProps extends Omit<PressableProps, 'onPress'> {
  onPress?: () => void;
  size?: number;
  className?: string;
}

export function BackButton({
  onPress,
  size = 20,
  className,
  hitSlop = 12,
  ...props
}: Readonly<BackButtonProps>) {
  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) router.back();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className={cn(
        'h-10 w-10 items-center justify-center rounded-xl bg-card active:opacity-70',
        className,
      )}
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
      {...props}
    >
      <Icon name="ArrowLeft" size={size} />
    </Pressable>
  );
}
