import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from './atoms/Toast';
import { useToastStore } from '@/lib/toast/toast.store';

/**
 * Fixed bottom overlay that stacks active toasts. Mounted once globally (near
 * the PortalHost / InAppBannerHost in app/_layout.tsx). Sits above the global
 * bottom tab bar so messages stay visible app-wide; tapping a toast dismisses it.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', bottom: insets.bottom + 96, left: 0, right: 0 }}
      className="px-4"
    >
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onDismiss={remove} />
      ))}
    </View>
  );
}
