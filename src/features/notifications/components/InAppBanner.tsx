import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatRelative } from '@/lib/format/date';

import { NOTIFICATION_CATEGORY_LABEL } from '../constants/categories';
import { type NotificationBannerItem, useNotificationsStore } from '../store/notifications.store';
import { NotificationAvatar } from './NotificationAvatar';

const BANNER_DURATION = 8000;
const EXIT_DURATION = 300;

interface Props {
  item: NotificationBannerItem;
  onPress: (item: NotificationBannerItem) => void;
}

/**
 * One in-app toast. Auto-dismisses after 8s with a 300ms slide/fade exit;
 * also dismissable via the close button. Mirrors the web NotificationBanner.
 */
export function InAppBanner({ item, onPress }: Readonly<Props>) {
  const startExitBanner = useNotificationsStore((s) => s.startExitBanner);
  const removeBanner = useNotificationsStore((s) => s.removeBanner);
  const anim = useRef(new Animated.Value(0)).current; // 0 = shown, 1 = exiting
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = (): void => {
    if (timer.current) clearTimeout(timer.current);
    startExitBanner(item.id);
    Animated.timing(anim, {
      toValue: 1,
      duration: EXIT_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => removeBanner(item.id));
  };

  useEffect(() => {
    timer.current = setTimeout(dismiss, BANNER_DURATION);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { notification } = item;

  return (
    <Animated.View
      style={{
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }],
      }}
      className="mb-3 w-full"
    >
      <Pressable
        onPress={() => onPress(item)}
        className="flex-row items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card active:opacity-90"
        accessibilityRole="button"
      >
        <NotificationAvatar notification={notification} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold">
            {notification.title}
          </Text>
          <Text variant="muted" numberOfLines={2} className="mt-0.5">
            {notification.body}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <Text className="text-xs text-muted-foreground">
              {NOTIFICATION_CATEGORY_LABEL[notification.category]}
            </Text>
            <View className="h-1 w-1 rounded-full bg-muted-foreground" />
            <Text className="text-xs text-muted-foreground">
              {formatRelative(notification.createdAt)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          accessibilityLabel="Dismiss"
          className="p-1 active:opacity-60"
        >
          <Icon name="X" size={16} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
