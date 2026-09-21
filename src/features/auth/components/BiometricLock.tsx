import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { authenticateBiometric } from '@/lib/biometrics';
import { useAuthStore } from '@/store/auth.store';

/**
 * Full-screen opaque overlay shown on cold start when the session was restored
 * AND quick-unlock is enabled. Auto-prompts the biometric sheet on mount; the
 * app content already mounted behind it stays hidden until `onUnlock` fires.
 */
export function BiometricLock({ onUnlock }: Readonly<{ onUnlock: () => void }>) {
  const [authenticating, setAuthenticating] = useState(false);

  const tryUnlock = useCallback(async () => {
    setAuthenticating(true);
    const ok = await authenticateBiometric('Unlock RHK Properties');
    setAuthenticating(false);
    if (ok) onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    tryUnlock();
  }, [tryUnlock]);

  const usePassword = () => {
    // Drop the restored session and send the user back through normal login.
    useAuthStore.getState().clearAuth();
    onUnlock();
    router.replace('/(auth)/login');
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      className="items-center justify-center gap-6 bg-background px-8"
    >
      <Icon name="ScanFace" size={56} />
      <Text className="text-center text-lg font-semibold text-foreground">Unlock to continue</Text>
      <View className="w-full gap-3">
        <Button onPress={tryUnlock} loading={authenticating}>
          <Text>Unlock</Text>
        </Button>
        <Button variant="ghost" onPress={usePassword}>
          <Text>Use password instead</Text>
        </Button>
      </View>
    </View>
  );
}
