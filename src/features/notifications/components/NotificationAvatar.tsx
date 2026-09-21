import { View } from 'react-native';

import { Avatar, AvatarImage } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import type { Notification } from '../types';

// Ported verbatim from the web NotificationAvatar (palette + hashing).
const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function getAvatarColor(name: string): string {
  const code = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length] ?? '#6b7280';
}

/**
 * Actor avatar with the web fallback chain:
 * actorAvatarUrl image → hashed-color initials → bell icon.
 * Read notifications dim to 70% opacity (mirrors web).
 */
export function NotificationAvatar({ notification }: Readonly<{ notification: Notification }>) {
  const { isRead, data } = notification;
  const actorAvatarUrl = data?.actorAvatarUrl;
  const actorName = data?.actorName;
  const dim = isRead ? 'opacity-70' : '';

  if (actorAvatarUrl) {
    return (
      <Avatar alt={actorName ?? notification.title} className={cn('h-10 w-10', dim)}>
        <AvatarImage source={{ uri: actorAvatarUrl }} />
      </Avatar>
    );
  }

  if (!actorName) {
    return (
      <View
        className={cn('h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted', dim)}
      >
        <Icon name="Bell" size={18} />
      </View>
    );
  }

  return (
    <View
      className={cn('h-10 w-10 shrink-0 items-center justify-center rounded-full', dim)}
      style={{ backgroundColor: getAvatarColor(actorName) }}
    >
      <Text className="text-sm font-semibold text-white">{getInitials(actorName)}</Text>
    </View>
  );
}
