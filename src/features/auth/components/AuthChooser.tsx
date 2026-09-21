import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { signinWithAppleIdToken, signinWithGoogleIdToken } from '@/features/auth/services';
import { GoogleSignInCancelledError, signInWithGoogle } from '@/features/auth/google-signin';
import {
  AppleSignInCancelledError,
  isAppleSignInAvailable,
  signInWithApple,
} from '@/features/auth/apple-signin';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { AppleSignInButton } from '@/features/auth/components/AppleSignInButton';
import { ApiError } from '@/lib/api-error';
import { tokens } from '@theme/tokens';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;

interface AuthChooserProps {
  /** Switch the parent flow to the email/password form view. */
  onEmailPress: () => void;
  /**
   * Called after a successful social sign-in. Defaults to navigating into the
   * app; the in-place AuthPromptModal passes a handler that closes the modal.
   */
  onAuthSuccess?: () => void;
}

export function AuthChooser({ onEmailPress, onAuthSuccess }: Readonly<AuthChooserProps>) {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const handleAuthSuccess = () => {
    if (onAuthSuccess) onAuthSuccess();
    else router.replace('/');
  };

  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    isAppleSignInAvailable()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  async function handleGoogleSignIn(): Promise<void> {
    setGoogleError(null);
    setIsGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const response = await signinWithGoogleIdToken(idToken);
      setAuth(response.user, response.tokens);
      handleAuthSuccess();
    } catch (e) {
      if (e instanceof GoogleSignInCancelledError) return;
      const apiErr = e instanceof ApiError ? e : null;
      setGoogleError(apiErr?.message ?? 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleAppleSignIn(): Promise<void> {
    setAppleError(null);
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      const response = await signinWithAppleIdToken(result);
      setAuth(response.user, response.tokens);
      handleAuthSuccess();
    } catch (e) {
      if (e instanceof AppleSignInCancelledError) return;
      const apiErr = e instanceof ApiError ? e : null;
      setAppleError(apiErr?.message ?? 'Apple sign-in failed. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  }

  return (
    <View>
      <Text className="mb-1 text-center text-2xl font-bold text-foreground">Welcome</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">
        Choose how you want to continue
      </Text>

      {/* Apple — system-rendered button (Apple HIG); iOS 13+ only */}
      {appleAvailable ? (
        <View className="mb-3">
          <AppleSignInButton
            onPress={handleAppleSignIn}
            loading={isAppleLoading}
            disabled={isAppleLoading}
          />
          {appleError ? (
            <Text className="mt-3 text-center text-sm text-destructive">{appleError}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Google — official branded button (Google branding guidelines) */}
      <GoogleSignInButton
        onPress={handleGoogleSignIn}
        loading={isGoogleLoading}
        disabled={isGoogleLoading}
      />
      {googleError ? (
        <Text className="mt-3 text-center text-sm text-destructive">{googleError}</Text>
      ) : null}

      {/* Email — switches the flow to the tabbed sign in / sign up form.
          Same Button atom (outline, size lg, rounded-2xl, full width) as the
          Google/Apple buttons so all three stack pixel-identically. */}
      <Button
        onPress={onEmailPress}
        variant="outline"
        size="lg"
        className="mt-3 w-full rounded-2xl"
        accessibilityLabel="Continue with Email"
      >
        <Mail size={20} color={mutedFg} strokeWidth={1.8} />
        <Text>Continue with Email</Text>
      </Button>
    </View>
  );
}
