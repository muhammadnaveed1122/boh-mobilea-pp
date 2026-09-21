import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';
import { useAuthStore } from '@/store/auth.store';

export function EnableMfaPrompt() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mfaPromptDismissed = useAuthStore((s) => s.mfaPromptDismissed);
  const mfaPromptArmed = useAuthStore((s) => s.mfaPromptArmed);
  const dismissMfaPrompt = useAuthStore((s) => s.dismissMfaPrompt);

  const shouldShow =
    mfaPromptArmed &&
    isAuthenticated &&
    user !== null &&
    user.mfaEnabled === false &&
    !mfaPromptDismissed;

  function handleEnable() {
    dismissMfaPrompt();
    router.push('/(app)/mfa-setup' as never);
  }

  return (
    <Dialog
      visible={shouldShow}
      onRequestClose={dismissMfaPrompt}
      title="Secure your account"
      description="Enable two-factor authentication to add an extra layer of security to your account. You'll be asked for a code from your authenticator app when you sign in."
      dismissOnBackdropPress={false}
    >
      <View className="flex-row gap-2">
        <Button
          onPress={dismissMfaPrompt}
          variant="outline"
          size="lg"
          className="flex-1 rounded-2xl"
        >
          <Text>Later</Text>
        </Button>
        <Button onPress={handleEnable} size="lg" className="flex-1 rounded-2xl">
          <Text>Enable</Text>
        </Button>
      </View>
    </Dialog>
  );
}
