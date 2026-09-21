import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { VerifySignupOtpForm } from '@/features/auth/components/VerifySignupOtpForm';
import { useAuthStore } from '@/store/auth.store';

export default function VerifySignupOtpScreen() {
  const router = useRouter();
  const pendingSignup = useAuthStore((s) => s.pendingSignup);
  const clearPendingSignup = useAuthStore((s) => s.clearPendingSignup);

  useEffect(() => {
    if (!pendingSignup) {
      router.replace('/(auth)/login');
    }
  }, [pendingSignup, router]);

  function handleDismiss() {
    clearPendingSignup();
    router.replace('/(auth)/login');
  }

  if (!pendingSignup) return null;

  return (
    <AuthSheet onSkip={handleDismiss}>
      <VerifySignupOtpForm />
    </AuthSheet>
  );
}
