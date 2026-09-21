import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';
import { forgotPasswordMobile } from '@/features/auth/services';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import type { ForgotPasswordFormValues } from '@/features/auth/forms/forgot-password.schema';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const setPendingSignup = useAuthStore((s) => s.setPendingSignup);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ForgotPasswordFormValues) {
    setError(null);
    try {
      const res = await forgotPasswordMobile(values.email);
      setPendingSignup({
        email: values.email,
        resendAvailableAt: res.resendAvailableAt,
        flow: 'reset',
      });
      router.push('/(auth)/verify-signup-otp');
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setError(err?.message ?? 'Could not send the code. Please try again.');
    }
  }

  function handleDismiss() {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  }

  return (
    <AuthSheet onSkip={handleDismiss}>
      <ForgotPasswordForm onSubmit={handleSubmit} error={error} />
    </AuthSheet>
  );
}
