import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';
import { useAuthStore } from '@/store/auth.store';

import { usePushPermissions } from '../hooks/use-push-permissions';

/**
 * Recovery prompt for the OS 'blocked' push state. The OS permission dialog is
 * one-shot (iOS: ever; Android: after a hard "Don't allow"), so a user who once
 * dismissed it is never re-prompted by `usePushTokenRegistration`. This surfaces
 * that dead end after login — when the user still wants push (in-app pref on)
 * but the OS refuses — and deep-links them to Settings, the only recovery path.
 *
 * Shown once per app session (dismiss is local state); re-armed on cold start.
 * A standing 'granted' or a deliberate in-app opt-out (pref off) never shows it.
 */
export function EnablePushPrompt() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { status, openSettings } = usePushPermissions();
  const [dismissed, setDismissed] = useState(false);

  const pushPref = user?.pushNotificationsEnabled ?? true;
  const shouldShow =
    isAuthenticated && user !== null && pushPref && status === 'blocked' && !dismissed;

  function handleOpenSettings() {
    setDismissed(true);
    openSettings();
  }

  return (
    <Dialog
      visible={shouldShow}
      onRequestClose={() => setDismissed(true)}
      title="Turn on notifications"
      description="Notifications are blocked for this app in your device settings. Open Settings and allow notifications to receive alerts about your leads and listings."
      dismissOnBackdropPress={false}
    >
      <View className="flex-row gap-2">
        <Button
          onPress={() => setDismissed(true)}
          variant="outline"
          size="lg"
          className="flex-1 rounded-2xl"
        >
          <Text numberOfLines={1}>Not now</Text>
        </Button>
        <Button onPress={handleOpenSettings} size="lg" className="flex-1 rounded-2xl">
          <Text numberOfLines={1}>Settings</Text>
        </Button>
      </View>
    </Dialog>
  );
}
