import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useVerifySignupOtpForm } from '@/features/auth/forms/verify-signup-otp.form';
import {
  forgotPasswordMobile,
  resendReactivationOtp,
  resendSignupOtp,
  verifyPasswordResetOtp,
  verifyReactivationOtp,
  verifySignupOtp,
} from '@/features/auth/services';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { tokens } from '@theme/tokens';
import type { OtpFlow } from '@/store/auth.store';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;
const primary = `rgb(${tokens.light['--primary']})`;

function computeCountdown(availableAt: string | undefined): number {
  if (!availableAt) return 0;
  const diff = Math.ceil((new Date(availableAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface FlowCopy {
  title: string;
  subtitle: (email: string) => string;
}

const COPY: Record<OtpFlow, FlowCopy> = {
  signup: {
    title: 'Verify your email',
    subtitle: (email) => `We sent a 6-digit code to ${email}. Enter it below to finish signing up.`,
  },
  reset: {
    title: 'Reset your password',
    subtitle: (email) =>
      `We sent a 6-digit code to ${email}. Enter it below to set a new password.`,
  },
  reactivation: {
    title: 'Reactivate your account',
    subtitle: (email) =>
      `We sent a 6-digit code to ${email}. Enter it below to restore your account.`,
  },
};

export function VerifySignupOtpForm() {
  const router = useRouter();
  const pendingSignup = useAuthStore((s) => s.pendingSignup);
  const setPendingSignup = useAuthStore((s) => s.setPendingSignup);
  const setVerifiedSignupToken = useAuthStore((s) => s.setVerifiedSignupToken);
  const clearPendingSignup = useAuthStore((s) => s.clearPendingSignup);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(() =>
    computeCountdown(pendingSignup?.resendAvailableAt),
  );

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    setCountdown(computeCountdown(pendingSignup?.resendAvailableAt));
  }, [pendingSignup?.resendAvailableAt]);

  const flow: OtpFlow = pendingSignup?.flow ?? 'signup';
  const copy = COPY[flow];

  const form = useVerifySignupOtpForm(async (values) => {
    if (!pendingSignup) {
      clearPendingSignup();
      router.replace('/(auth)/login');
      return;
    }
    setSubmitError(null);
    try {
      if (flow === 'reactivation') {
        const response = await verifyReactivationOtp({
          email: pendingSignup.email,
          code: values.code.trim(),
        });
        setAuth(response.user, response.tokens);
        clearPendingSignup();
        router.replace('/');
        return;
      }
      const verifyFn = flow === 'reset' ? verifyPasswordResetOtp : verifySignupOtp;
      const response = await verifyFn({
        email: pendingSignup.email,
        code: values.code.trim(),
      });
      setVerifiedSignupToken(response.token, response.expiresAt);
      router.push('/(auth)/set-password');
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (flow === 'signup' && err?.code === 'ALREADY_VERIFIED') {
        clearPendingSignup();
        router.replace('/(auth)/login');
        return;
      }
      setSubmitError(err?.message ?? 'Verification failed. Please try again.');
    }
  });

  async function handleResend() {
    if (!pendingSignup || countdown > 0 || isResending) return;
    setResendError(null);
    setIsResending(true);
    try {
      const resendFnByFlow = {
        signup: resendSignupOtp,
        reset: forgotPasswordMobile,
        reactivation: resendReactivationOtp,
      };
      const res = await resendFnByFlow[flow](pendingSignup.email);
      setPendingSignup({
        email: pendingSignup.email,
        resendAvailableAt: res.resendAvailableAt,
        flow,
      });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setResendError(err?.message ?? 'Could not resend the code. Please try again.');
    } finally {
      setIsResending(false);
    }
  }

  function handleBack() {
    clearPendingSignup();
    router.replace('/(auth)/login');
  }

  if (!pendingSignup) {
    return null;
  }

  return (
    <>
      <View className="mb-3 items-center">
        <Mail size={36} color={primary} strokeWidth={1.8} />
      </View>
      <Text className="mb-1 text-center text-2xl font-bold text-foreground">{copy.title}</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">
        {copy.subtitle(pendingSignup.email)}
      </Text>

      <View className="mb-3">
        <form.AppField name="code">
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
            loadingLabel="Verifying"
            size="lg"
            className="mb-3 rounded-2xl"
          >
            <Text>Verify</Text>
          </Button>
        )}
      </form.Subscribe>

      <View className="mb-3 items-center">
        {countdown > 0 ? (
          <Text className="text-sm text-muted-foreground">
            Resend code in {formatCountdown(countdown)}
          </Text>
        ) : (
          <Pressable hitSlop={8} onPress={handleResend} disabled={isResending}>
            <Text className="text-sm font-semibold text-primary">
              {isResending ? 'Sending...' : 'Resend code'}
            </Text>
          </Pressable>
        )}
      </View>

      {resendError ? (
        <Text className="mb-3 text-center text-sm text-destructive">{resendError}</Text>
      ) : null}

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
