import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMarkRead } from '../hooks/use-mark-read';
import { type NotificationBannerItem, useNotificationsStore } from '../store/notifications.store';
import { resolveRedirect } from '../utils/resolve-redirect';
import { InAppBanner } from './InAppBanner';

/**
 * Fixed top overlay that stacks active in-app banners. Mounted once globally
 * (near the PortalHost in app/_layout.tsx). Tapping a banner marks it read,
 * removes it, and deep-links via the redirect resolver.
 */
export function InAppBannerHost() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const banners = useNotificationsStore((s) => s.banners);
  const removeBanner = useNotificationsStore((s) => s.removeBanner);
  const markRead = useMarkRead();

  if (banners.length === 0) return null;

  const handlePress = (item: NotificationBannerItem): void => {
    markRead.mutate(item.notification.id);
    removeBanner(item.id);
    const href = resolveRedirect(item.notification);
    if (href) {
      router.push(href as never);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }}
      className="px-4"
    >
      {banners.map((item) => (
        <InAppBanner key={item.id} item={item} onPress={handlePress} />
      ))}
    </View>
  );
}
