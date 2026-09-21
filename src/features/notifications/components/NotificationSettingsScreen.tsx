import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Switch } from '@/components/atoms/Switch';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import { openFullScreenIntentSettings } from '@/features/callService/services/full-screen-intent';
import { useHasCallingExtension } from '@/features/callService/hooks/use-sip-config';
import { useAuthStore } from '@/store/auth.store';

import { usePushPermissions } from '../hooks/use-push-permissions';
import { updateNotificationPrefs } from '../services';

interface ToggleRowProps {
  icon: IconName;
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  disabled,
  onToggle,
}: Readonly<ToggleRowProps>) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-4">
      <View className="flex-1 flex-row items-start gap-3">
        <View className="mt-0.5">
          <Icon name={icon} size={20} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium">{label}</Text>
          <Text variant="muted" className="mt-0.5">
            {description}
          </Text>
        </View>
      </View>
      <Switch checked={value} onCheckedChange={onToggle} disabled={disabled} />
    </View>
  );
}

/**
 * Two global toggles (web parity): In-app alerts + Push notifications. Backed
 * by User.notificationsEnabled / pushNotificationsEnabled via PATCH
 * /auth/profile. Optimistic with revert. Enabling push first requests OS
 * permission; denied/blocked routes the user to OS settings.
 */
export function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { status, request, openSettings } = usePushPermissions();
  const hasCallingExtension = useHasCallingExtension();

  // Android 14+ only: USE_FULL_SCREEN_INTENT is a per-app grant the user controls
  // in system settings. Shown to calling-capable users so they can (re)enable
  // full-screen lock-screen incoming calls.
  const showFullScreenIntent =
    Platform.OS === 'android' && Number(Platform.Version) >= 34 && hasCallingExtension;

  const [inApp, setInApp] = useState(user?.notificationsEnabled ?? true);
  const [push, setPush] = useState(user?.pushNotificationsEnabled ?? true);
  const [busy, setBusy] = useState(false);

  const persist = async (
    prefs: { notificationsEnabled?: boolean; pushNotificationsEnabled?: boolean },
    revert: () => void,
  ): Promise<void> => {
    setBusy(true);
    try {
      await updateNotificationPrefs(prefs);
      await refreshProfile();
    } catch {
      revert();
      Alert.alert('Update failed', 'Could not save your notification settings. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleInApp = (): void => {
    const next = !inApp;
    setInApp(next);
    void persist({ notificationsEnabled: next }, () => setInApp(!next));
  };

  const effectivePush = push && status === 'granted';

  const togglePush = async (): Promise<void> => {
    const next = !effectivePush;
    if (next) {
      if (status === 'blocked') {
        Alert.alert(
          'Notifications are off',
          'Enable notifications for this app in system settings to receive push alerts.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings },
          ],
        );
        return;
      }
      const result = status === 'granted' ? 'granted' : await request();
      if (result !== 'granted') {
        if (result === 'blocked') {
          Alert.alert(
            'Notifications are off',
            'Enable notifications for this app in system settings to receive push alerts.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: openSettings },
            ],
          );
        }
        return;
      }
    }
    setPush(next);
    void persist({ pushNotificationsEnabled: next }, () => setPush(!next));
    // Disabling stops push at the app level (the device token is removed, so the
    // server no longer sends). The OS permission itself can't be revoked from
    // code — offer the system settings switch for a full OS-level opt-out.
    if (!next && status === 'granted') {
      Alert.alert(
        'Push notifications disabled',
        'You will no longer receive push alerts. To also turn them off at the system level, open Settings.',
        [
          { text: 'Done', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    }
  };

  const pushDescription =
    status === 'blocked'
      ? 'Blocked in system settings. Tap to open and enable.'
      : status === 'denied'
        ? 'Permission not granted. Toggle on to request.'
        : 'Send push alerts to this device even when the app is closed.';

  return (
    <View
      className="flex-1 bg-background px-4"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom }}
    >
      <Card className="p-5">
        <Text className="text-base font-semibold">Notifications</Text>
        <Text variant="muted" className="mt-1">
          Manage how you receive notifications.
        </Text>

        <View className="mt-2 divide-y divide-border">
          <ToggleRow
            icon={inApp ? 'Bell' : 'BellOff'}
            label="In-App Alerts"
            description="Show a banner when a notification arrives while the app is open."
            value={inApp}
            disabled={busy}
            onToggle={toggleInApp}
          />
          <ToggleRow
            icon={effectivePush ? 'Smartphone' : 'SmartphoneNfc'}
            label="Push Notifications"
            description={pushDescription}
            value={effectivePush}
            disabled={busy}
            onToggle={() => {
              void togglePush();
            }}
          />
        </View>
      </Card>

      {showFullScreenIntent ? (
        <Card className="mt-4 p-5">
          <Text className="text-base font-semibold">Incoming calls</Text>
          <Text variant="muted" className="mt-1">
            Control how incoming calls appear on your lock screen.
          </Text>
          <Pressable
            onPress={() => void openFullScreenIntentSettings()}
            className="mt-2 flex-row items-center justify-between gap-4 py-4 active:opacity-70"
          >
            <View className="flex-1 flex-row items-start gap-3">
              <View className="mt-0.5">
                <Icon name="PhoneIncoming" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium">Full-screen call display</Text>
                <Text variant="muted" className="mt-0.5">
                  Allow full-screen notifications so incoming calls show full-screen on the lock
                  screen.
                </Text>
              </View>
            </View>
            <Icon name="ChevronRight" size={16} />
          </Pressable>
        </Card>
      ) : null}
    </View>
  );
}
