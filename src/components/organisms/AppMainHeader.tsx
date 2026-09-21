import { router } from 'expo-router';
import { useUnreadCount } from '@/features/notifications/hooks/use-unread-count';
import { MainHeader } from './MainHeader';

/**
 * Connected `MainHeader`: wires the live unread count and notifications
 * navigation so each tab-root screen can drop it in without repeating the
 * wiring. Rendered *inside* the screen (not as a global overlay) so it rides
 * the native-stack pop transition — returning via the OS swipe-back gesture
 * shows it in sync with the revealed screen instead of after a delay.
 */
export function AppMainHeader() {
  const unreadCount = useUnreadCount();
  return (
    <MainHeader
      unreadCount={unreadCount}
      onPressNotifications={() => router.push('/(app)/notifications')}
    />
  );
}
