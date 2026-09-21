import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { SetPasswordForm } from '@/features/auth/components/SetPasswordForm';
import { useAuthStore } from '@/store/auth.store';

export default function SetPasswordScreen() {
  const router = useRouter();
  const pendingSignup = useAuthStore((s) => s.pendingSignup);
  const verifiedSignupToken = useAuthStore((s) => s.verifiedSignupToken);
  const clearPendingSignup = useAuthStore((s) => s.clearPendingSignup);

  useEffect(() => {
    if (!verifiedSignupToken || !pendingSignup) {
      router.replace('/(auth)/login');
    }
  }, [verifiedSignupToken, pendingSignup, router]);

  function handleDismiss() {
    clearPendingSignup();
    router.replace('/(auth)/login');
  }

  if (!verifiedSignupToken || !pendingSignup) return null;

  return (
    <AuthSheet onSkip={handleDismiss}>
      <SetPasswordForm />
    </AuthSheet>
  );
}
