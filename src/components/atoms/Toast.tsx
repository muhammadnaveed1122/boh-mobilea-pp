import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { cn } from '@/lib/utils';
import type { ToastItem, ToastType } from '@/lib/toast/toast.store';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const TYPE_STYLES: Record<ToastType, { container: string; text: string; icon: IconName }> = {
  error: {
    container: 'bg-destructive',
    text: 'text-destructive-foreground',
    icon: 'TriangleAlert',
  },
  success: { container: 'bg-success', text: 'text-success-foreground', icon: 'Check' },
  info: { container: 'bg-info', text: 'text-info-foreground', icon: 'Info' },
};

interface Props {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ item, onDismiss }: Readonly<Props>) {
  const style = TYPE_STYLES[item.type];
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} className="mb-2">
      <Pressable
        accessibilityRole="button"
        onPress={() => onDismiss(item.id)}
        className={cn(
          'flex-row items-center gap-3 rounded-2xl px-4 py-3 shadow-lg',
          style.container,
        )}
      >
        <Icon name={style.icon} size={20} color="white" />
        <View className="flex-1">
          <Text numberOfLines={3} className={cn('text-sm font-medium', style.text)}>
            {item.message}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
