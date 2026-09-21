import { Redirect, useRouter } from 'expo-router';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { AuthFlow } from '@/features/auth/components/AuthFlow';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const skipAuth = useAuthStore((s) => s.skipAuth);
  const pendingSignup = useAuthStore((s) => s.pendingSignup);
  const verifiedSignupToken = useAuthStore((s) => s.verifiedSignupToken);

  function handleSkip() {
    skipAuth();
    router.replace('/');
  }

  // A cold start restored an unfinished signup whose set-password window is still open.
  // Drop the user back where they left off instead of at a sign-in form.
  if (verifiedSignupToken && pendingSignup) {
    return <Redirect href="/(auth)/set-password" />;
  }

  return (
    <AuthSheet onSkip={handleSkip}>
      <AuthFlow />
    </AuthSheet>
  );
}
