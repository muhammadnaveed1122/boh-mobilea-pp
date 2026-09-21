import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { useMfaTotpPromptForm } from '@/features/auth/forms/mfa-totp-prompt.form';
import { regenerateMfaBackupCodes } from '@/features/auth/services';
import { ApiError } from '@/lib/api-error';
import { tokens } from '@theme/tokens';
import { BackupCodesList } from './mfa/BackupCodesList';
import { MfaScreenHeader } from './mfa/MfaScreenHeader';

const primary = `rgb(${tokens.light['--primary']})`;

type Stage = 'prompt' | 'display';

export function MfaRegenerateBackupCodesForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('prompt');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useMfaTotpPromptForm(async (values) => {
    setSubmitError(null);
    try {
      const response = await regenerateMfaBackupCodes({ token: values.token.trim() });
      setBackupCodes(response.backupCodes);
      setStage('display');
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
      <MfaScreenHeader title="Regenerate backup codes" onClose={handleClose} />

      {stage === 'prompt' ? (
        <PromptStep form={form} submitError={submitError} onCancel={handleClose} />
      ) : (
        <DisplayStep backupCodes={backupCodes} onDone={handleClose} />
      )}
    </ScrollView>
  );
}

interface PromptStepProps {
  form: ReturnType<typeof useMfaTotpPromptForm>;
  submitError: string | null;
  onCancel: () => void;
}

function PromptStep({ form, submitError, onCancel }: Readonly<PromptStepProps>) {
  return (
    <View>
      <View className="mb-3 items-center">
        <KeyRound size={36} color={primary} strokeWidth={1.8} />
      </View>
      <Text className="mb-1 text-center text-2xl font-bold text-foreground">
        Regenerate backup codes
      </Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app. Your existing backup codes will be
        invalidated and replaced with a new set.
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
            loadingLabel="Generating new codes"
            size="lg"
            className="mb-3 rounded-2xl"
          >
            <Text>Generate new codes</Text>
          </Button>
        )}
      </form.Subscribe>

      <Button onPress={onCancel} variant="outline" size="lg" className="rounded-2xl">
        <Text>Cancel</Text>
      </Button>
    </View>
  );
}

interface DisplayStepProps {
  backupCodes: readonly string[];
  onDone: () => void;
}

function DisplayStep({ backupCodes, onDone }: Readonly<DisplayStepProps>) {
  return (
    <View>
      <Text className="mb-1 text-2xl font-bold text-foreground">Your new backup codes</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Your previous backup codes have been invalidated.
      </Text>
      <BackupCodesList codes={backupCodes} title="New backup codes" />

      <Button onPress={onDone} size="lg" className="rounded-2xl">
        <Text>I&rsquo;ve saved my new codes</Text>
      </Button>
    </View>
  );
}
