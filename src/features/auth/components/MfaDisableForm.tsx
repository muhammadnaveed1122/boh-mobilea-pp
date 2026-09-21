import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldOff } from 'lucide-react-native';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { useMfaTotpPromptForm } from '@/features/auth/forms/mfa-totp-prompt.form';
import { disableMfa } from '@/features/auth/services';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { tokens } from '@theme/tokens';
import { MfaScreenHeader } from './mfa/MfaScreenHeader';

const destructive = `rgb(${tokens.light['--destructive']})`;

type Stage = 'prompt' | 'done';

export function MfaDisableForm() {
  const router = useRouter();
  const setUserMfaEnabled = useAuthStore((s) => s.setUserMfaEnabled);
  const [stage, setStage] = useState<Stage>('prompt');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useMfaTotpPromptForm(async (values) => {
    setSubmitError(null);
    try {
      await disableMfa({ token: values.token.trim() });
      setUserMfaEnabled(false);
      setStage('done');
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setSubmitError(err?.message ?? 'Invalid code. Try again.');
    }
  });

  function handleClose() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <MfaScreenHeader title="Disable two-factor" onClose={handleClose} />

      {stage === 'prompt' ? (
        <View>
          <View className="mb-3 items-center">
            <ShieldOff size={36} color={destructive} strokeWidth={1.8} />
          </View>
          <Text className="mb-1 text-center text-2xl font-bold text-foreground">
            Disable two-factor
          </Text>
          <Text className="mb-6 text-center text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app to turn off two-factor
            authentication. Your backup codes will also be invalidated.
          </Text>

          <View className="mb-3">
            <form.AppField name="token">
              {(field) => (
                <field.Input
                  placeholder="123456"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                />
              )}
            </form.AppField>
          </View>

          {submitError ? (
            <Text className="mb-3 text-center text-sm text-destructive">{submitError}</Text>
          ) : null}

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                onPress={form.handleSubmit}
                disabled={!canSubmit}
                loading={isSubmitting}
                loadingLabel="Disabling"
                variant="destructive"
                size="lg"
                className="mb-3 rounded-2xl"
              >
                <Text>Disable two-factor</Text>
              </Button>
            )}
          </form.Subscribe>

          <Button onPress={handleClose} variant="outline" size="lg" className="rounded-2xl">
            <Text>Cancel</Text>
          </Button>
        </View>
      ) : null}

      {stage === 'done' ? (
        <View className="items-center py-8">
          <ShieldOff size={48} color={destructive} strokeWidth={1.8} />
          <Text className="mt-3 text-center text-2xl font-bold text-foreground">
            Two-factor disabled
          </Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            We recommend re-enabling two-factor authentication soon to keep your account secure.
          </Text>
          <Button onPress={handleClose} size="lg" className="mt-6 w-full rounded-2xl">
            <Text>Done</Text>
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
}
