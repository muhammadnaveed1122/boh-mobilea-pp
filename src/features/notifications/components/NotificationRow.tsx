import { Pressable, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { formatRelative } from '@/lib/format/date';
import { cn } from '@/lib/utils';

import { NOTIFICATION_CATEGORY_LABEL } from '../constants/categories';
import type { Notification } from '../types';
import { NotificationAvatar } from './NotificationAvatar';

interface Props {
  notification: Notification;
  onPress: (n: Notification) => void;
}

/** Single notification list row (mirrors the web NotificationList row). */
export function NotificationRow({ notification, onPress }: Readonly<Props>) {
  const { isRead, title, body, category, createdAt } = notification;

  return (
    <Pressable
      onPress={() => onPress(notification)}
      className={cn(
        'flex-row items-start gap-3 rounded-xl p-3 active:opacity-70',
        !isRead && 'bg-muted/50',
      )}
      accessibilityRole="button"
    >
      <NotificationAvatar notification={notification} />

      <View className="min-w-0 flex-1">
        <View className="flex-row items-start gap-2">
          <Text
            numberOfLines={1}
            className={cn('flex-1 text-sm', isRead ? 'font-medium' : 'font-semibold')}
          >
            {title}
          </Text>
          {isRead ? null : <View className="mt-1.5 h-2 w-2 rounded-full bg-info" />}
        </View>

        <Text variant="muted" numberOfLines={2} className="mt-0.5">
          {body}
        </Text>

        <View className="mt-2 flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">
            {NOTIFICATION_CATEGORY_LABEL[category]}
          </Text>
          <View className="h-1 w-1 rounded-full bg-muted-foreground" />
          <Text className="text-xs text-muted-foreground">{formatRelative(createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}
