import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { MfaVerifyForm } from '@/features/auth/components/MfaVerifyForm';
import { useAuthStore } from '@/store/auth.store';

export default function MfaVerifyScreen() {
  const router = useRouter();
  const mfaChallenge = useAuthStore((s) => s.mfaChallenge);
  const setMfaChallenge = useAuthStore((s) => s.setMfaChallenge);

  useEffect(() => {
    if (!mfaChallenge) {
      router.replace('/(auth)/login');
    }
  }, [mfaChallenge, router]);

  function handleDismiss() {
    setMfaChallenge(null);
    router.replace('/(auth)/login');
  }

  if (!mfaChallenge) return null;

  return (
    <AuthSheet onSkip={handleDismiss}>
      <MfaVerifyForm />
    </AuthSheet>
  );
}
