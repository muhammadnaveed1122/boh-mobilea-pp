import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useForgotPasswordForm } from '@/features/auth/forms/forgot-password.form';
import { tokens } from '@theme/tokens';
import type { ForgotPasswordFormValues } from '@/features/auth/forms/forgot-password.schema';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;

interface ForgotPasswordFormProps {
  onSubmit: (values: ForgotPasswordFormValues) => Promise<void>;
  error?: string | null;
}

export function ForgotPasswordForm({ onSubmit, error }: Readonly<ForgotPasswordFormProps>) {
  const router = useRouter();
  const form = useForgotPasswordForm(onSubmit);

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  }

  return (
    <>
      <Text className="mb-1 text-center text-2xl font-bold text-foreground">Forgot Password</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">
        Don&rsquo;t worry! Enter your email below to receive a verification code.
      </Text>

      <View className="mb-3">
        <form.AppField name="email">
          {(field) => (
            <field.Input
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={18} color={mutedFg} strokeWidth={1.8} />}
            />
          )}
        </form.AppField>
      </View>

      {error ? <Text className="mb-3 text-center text-sm text-destructive">{error}</Text> : null}

      <View className="h-40" />

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button
            onPress={form.handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            loadingLabel="Sending code"
            size="lg"
            className="mb-3 rounded-2xl"
          >
            <Text>Send</Text>
          </Button>
        )}
      </form.Subscribe>

      <Pressable
        onPress={handleBack}
        hitSlop={8}
        className="flex-row items-center justify-center gap-2 py-2"
      >
        <ArrowLeft size={16} color={mutedFg} strokeWidth={2} />
        <Text className="text-sm font-medium text-muted-foreground">Back</Text>
      </Pressable>
    </>
  );
}
