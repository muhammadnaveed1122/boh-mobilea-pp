import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useMfaVerifyForm } from '@/features/auth/forms/mfa-verify.form';
import { verifyMfaSignin } from '@/features/auth/services';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { ERROR_CODES } from '@/lib/api-types';
import { tokens } from '@theme/tokens';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;
const primary = `rgb(${tokens.light['--primary']})`;

export function MfaVerifyForm() {
  const router = useRouter();
  const mfaChallenge = useAuthStore((s) => s.mfaChallenge);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setMfaChallenge = useAuthStore((s) => s.setMfaChallenge);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');

  const form = useMfaVerifyForm(async (values) => {
    if (!mfaChallenge) {
      setMfaChallenge(null);
      router.replace('/(auth)/login');
      return;
    }
    setSubmitError(null);
    try {
      const response = await verifyMfaSignin({
        tempToken: mfaChallenge.tempToken,
        token: values.token.trim(),
        keepMeLoggedIn: mfaChallenge.keepMeLoggedIn,
        includeUserData: true,
      });
      setAuth(response.user, response.tokens);
      if (mode === 'backup') {
        Alert.alert(
          'Backup code used',
          'You just signed in with a backup code. This code has been invalidated and cannot be used again. We recommend regenerating your backup codes from MFA settings.',
          [{ text: 'Continue', onPress: () => router.replace('/') }],
          { cancelable: false },
        );
        return;
      }
      router.replace('/');
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.code === ERROR_CODES.TOKEN_EXPIRED || err?.code === ERROR_CODES.TOKEN_INVALID) {
        setMfaChallenge(null);
        router.replace('/(auth)/login');
        return;
      }
      if (err?.code === ERROR_CODES.TOO_MANY_REQUESTS) {
        setSubmitError(err.message || 'Too many attempts. Try again later.');
        return;
      }
      setSubmitError(err?.message ?? 'Invalid code. Please try again.');
    }
  });

  function handleBack() {
    setMfaChallenge(null);
    router.replace('/(auth)/login');
  }

  function handleToggleMode() {
    setMode((m) => (m === 'totp' ? 'backup' : 'totp'));
    form.setFieldValue('token', '');
    setSubmitError(null);
  }

  const title = mode === 'totp' ? 'Two-Factor Verification' : 'Use a Backup Code';
  const subtitle =
    mode === 'totp'
      ? 'Enter the 6-digit code from your authenticator app, or use a backup code.'
      : 'Enter one of your 8-digit backup codes. Each code can be used only once.';
  const placeholder = mode === 'totp' ? '123456' : '12345678';
  const toggleLabel =
    mode === 'totp' ? 'Use a backup code instead' : 'Use authenticator code instead';

  return (
    <>
      <View className="mb-3 items-center">
        <ShieldCheck size={36} color={primary} strokeWidth={1.8} />
      </View>
      <Text className="mb-1 text-center text-2xl font-bold text-foreground">{title}</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">{subtitle}</Text>

      <View className="mb-3">
        <form.AppField name="token">
          {(field) => (
            <field.Input
              placeholder={placeholder}
              keyboardType="numeric"
              autoCapitalize="none"
              autoComplete={mode === 'totp' ? 'one-time-code' : 'off'}
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
            loadingLabel="Verifying code"
            size="lg"
            className="mb-3 rounded-2xl"
          >
            <Text>Verify</Text>
          </Button>
        )}
      </form.Subscribe>

      <Pressable
        onPress={handleToggleMode}
        hitSlop={8}
        className="items-center justify-center py-2"
      >
        <Text className="text-sm font-medium text-primary">{toggleLabel}</Text>
      </Pressable>

      <Pressable
        onPress={handleBack}
        hitSlop={8}
        className="flex-row items-center justify-center gap-2 py-2"
      >
        <ArrowLeft size={16} color={mutedFg} strokeWidth={2} />
        <Text className="text-sm font-medium text-muted-foreground">Back to sign in</Text>
      </Pressable>
    </>
  );
}
