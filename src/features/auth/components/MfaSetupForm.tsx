import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { enableMfa, generateMfa } from '@/features/auth/services';
import { useMfaEnableForm } from '@/features/auth/forms/mfa-enable.form';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import type { MfaGenerateResponse } from '@/types/auth.types';
import { tokens } from '@theme/tokens';
import { BackupCodesList } from './mfa/BackupCodesList';
import { MfaScreenHeader } from './mfa/MfaScreenHeader';

const primary = `rgb(${tokens.light['--primary']})`;

type Stage = 'loading' | 'display' | 'verify' | 'done' | 'error';

export function MfaSetupForm() {
  const router = useRouter();
  const setUserMfaEnabled = useAuthStore((s) => s.setUserMfaEnabled);
  const [stage, setStage] = useState<Stage>('loading');
  const [setup, setSetup] = useState<MfaGenerateResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await generateMfa();
        if (cancelled) return;
        setSetup(data);
        setStage('display');
      } catch (e) {
        if (cancelled) return;
        const err = e instanceof ApiError ? e : null;
        setLoadError(err?.message ?? 'Failed to start MFA setup.');
        setStage('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useMfaEnableForm(async (values) => {
    if (!setup) return;
    setSubmitError(null);
    try {
      await enableMfa({
        secret: setup.secret,
        token: values.token.trim(),
        backupCodes: setup.backupCodes,
      });
      setUserMfaEnabled(true);
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
      <MfaScreenHeader title="Set up two-factor" onClose={handleClose} />

      {stage === 'loading' ? (
        <View className="items-center py-16">
          <ActivityIndicator color={primary} />
          <Text className="mt-3 text-sm text-muted-foreground">Generating setup details…</Text>
        </View>
      ) : null}

      {stage === 'error' ? (
        <View className="py-8">
          <Text className="text-center text-sm text-destructive">{loadError}</Text>
          <Button onPress={handleClose} variant="outline" size="lg" className="mt-6 rounded-2xl">
            <Text>Close</Text>
          </Button>
        </View>
      ) : null}

      {stage === 'display' && setup ? (
        <DisplayStep setup={setup} onContinue={() => setStage('verify')} />
      ) : null}

      {stage === 'verify' && setup ? (
        <View>
          <Text className="mb-1 text-2xl font-bold text-foreground">Verify code</Text>
          <Text className="mb-5 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app to confirm setup.
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
                loadingLabel="Enabling two-factor"
                size="lg"
                className="mb-3 rounded-2xl"
              >
                <Text>Enable two-factor</Text>
              </Button>
            )}
          </form.Subscribe>

          <Button
            onPress={() => setStage('display')}
            variant="outline"
            size="lg"
            className="rounded-2xl"
          >
            <Text>Back</Text>
          </Button>
        </View>
      ) : null}

      {stage === 'done' ? (
        <View className="items-center py-8">
          <ShieldCheck size={48} color={primary} strokeWidth={1.8} />
          <Text className="mt-3 text-center text-2xl font-bold text-foreground">
            Two-factor enabled
          </Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            Your account is now protected. You&rsquo;ll be asked for a code on your next sign in.
          </Text>
          <Button onPress={handleClose} size="lg" className="mt-6 w-full rounded-2xl">
            <Text>Done</Text>
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
}

interface DisplayStepProps {
  setup: MfaGenerateResponse;
  onContinue: () => void;
}

function DisplayStep({ setup, onContinue }: Readonly<DisplayStepProps>) {
  async function openInAuthenticator() {
    try {
      await Linking.openURL(setup.otpAuthUrl);
    } catch {
      // No authenticator app installed that handles otpauth:// — user can scan QR or enter key manually.
    }
  }

  return (
    <View>
      <Text className="mb-1 text-2xl font-bold text-foreground">Scan the QR code</Text>
      <Text className="mb-5 text-sm text-muted-foreground">
        Open your authenticator app (Google Authenticator, 1Password, Authy) and scan this QR code.
      </Text>

      <View className="mb-5 items-center">
        <View className="rounded-2xl bg-white p-4">
          <Image
            source={{ uri: setup.qrCodeDataUrl }}
            style={{ width: 200, height: 200 }}
            resizeMode="contain"
          />
        </View>
      </View>

      <Button
        onPress={openInAuthenticator}
        variant="outline"
        size="lg"
        className="mb-5 rounded-2xl"
      >
        <Text>Open in authenticator app</Text>
      </Button>

      <Text className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        Or enter this key manually
      </Text>
      <Text
        selectable
        className="mb-5 rounded-lg bg-muted px-3 py-2 font-mono text-sm text-foreground"
      >
        {setup.secret}
      </Text>

      <BackupCodesList codes={setup.backupCodes} />

      <Button onPress={onContinue} size="lg" className="rounded-2xl">
        <Text>I&rsquo;ve saved my backup codes</Text>
      </Button>
    </View>
  );
}
