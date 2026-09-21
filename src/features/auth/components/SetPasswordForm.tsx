import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useSetPasswordForm } from '@/features/auth/forms/set-password.form';
import { PASSWORD_RULES } from '@/features/auth/forms/password-policy';
import {
  forgotPasswordMobile,
  resendSignupOtp,
  setPassword,
  signinUser,
} from '@/features/auth/services';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { tokens } from '@theme/tokens';
import type { PendingSignup } from '@/store/auth.store';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;
const successFg = `rgb(${tokens.light['--brand']})`;

function PasswordChecklist({ password }: Readonly<{ password: string }>) {
  return (
    <View className="mb-4 gap-1.5">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.key} className="flex-row items-center gap-2">
            {met ? (
              <Check size={14} color={successFg} strokeWidth={2.5} />
            ) : (
              <X size={14} color={mutedFg} strokeWidth={2.5} />
            )}
            <Text className={cn('text-xs', met ? 'text-foreground' : 'text-muted-foreground')}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** True once the set-password window has closed and the server will reject the token. */
function isWindowClosed(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  return !Number.isFinite(expiry) || expiry <= Date.now();
}

export function SetPasswordForm() {
  const router = useRouter();
  const pendingSignup = useAuthStore((s) => s.pendingSignup);
  const verifiedSignupToken = useAuthStore((s) => s.verifiedSignupToken);
  const verifiedSignupTokenExpiresAt = useAuthStore((s) => s.verifiedSignupTokenExpiresAt);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPendingSignup = useAuthStore((s) => s.setPendingSignup);
  const clearPendingSignup = useAuthStore((s) => s.clearPendingSignup);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * The window lapsed (or the server rejected the token). Mint a new OTP and send the user
   * back one step rather than stranding them on a form whose token can never be redeemed.
   */
  async function restartVerification(pending: PendingSignup): Promise<void> {
    const resend = pending.flow === 'reset' ? forgotPasswordMobile : resendSignupOtp;
    try {
      const res = await resend(pending.email);
      // setPendingSignup drops the dead token from the store and from disk.
      setPendingSignup({
        email: pending.email,
        resendAvailableAt: res.resendAvailableAt,
        flow: pending.flow,
      });
      router.replace('/(auth)/verify-signup-otp');
    } catch {
      clearPendingSignup();
      router.replace('/(auth)/login');
    }
  }

  const form = useSetPasswordForm(async (values) => {
    if (!verifiedSignupToken || !pendingSignup) {
      clearPendingSignup();
      router.replace('/(auth)/login');
      return;
    }
    if (isWindowClosed(verifiedSignupTokenExpiresAt)) {
      setSubmitError(null);
      await restartVerification(pendingSignup);
      return;
    }
    setSubmitError(null);

    // Kept separate from the sign-in call below: a 401 here means the token died
    // (clock skew, or it was consumed elsewhere), which is recoverable via a new OTP.
    // A 401 from signinUser means something else entirely and must not restart the flow.
    try {
      await setPassword({ token: verifiedSignupToken, password: values.password });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 401) {
        await restartVerification(pendingSignup);
        return;
      }
      setSubmitError(err?.message ?? 'Could not set password. Please try again.');
      return;
    }

    try {
      const signinResponse = await signinUser({
        identifier: pendingSignup.email,
        password: values.password,
        includeUserData: true,
        keepMeLoggedIn: false,
      });

      if ('requiresMfa' in signinResponse || 'requiresReactivation' in signinResponse) {
        // Brand-new accounts can't have MFA or be inactive yet, but stay defensive.
        clearPendingSignup();
        router.replace('/(auth)/login');
        return;
      }

      setAuth(signinResponse.user, signinResponse.tokens);
      router.replace('/');
    } catch (e) {
      // The password IS set — only the convenience auto-sign-in failed. Send them to
      // sign in by hand rather than back through verification.
      const err = e instanceof ApiError ? e : null;
      clearPendingSignup();
      setSubmitError(err?.message ?? 'Password set. Please sign in.');
      router.replace('/(auth)/login');
    }
  });

  return (
    <>
      <View className="mb-3 items-center">
        <Lock size={36} color={mutedFg} strokeWidth={1.8} />
      </View>
      <Text className="mb-1 text-center text-2xl font-bold text-foreground">Set your password</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">
        Choose a password to finish creating your account.
      </Text>

      <View className="mb-3">
        <form.AppField name="password">
          {(field) => (
            <field.Input
              placeholder="Password"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              leftIcon={<Lock size={18} color={mutedFg} strokeWidth={1.8} />}
              rightElement={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  {showPassword ? (
                    <Eye size={18} color={mutedFg} strokeWidth={1.8} />
                  ) : (
                    <EyeOff size={18} color={mutedFg} strokeWidth={1.8} />
                  )}
                </Pressable>
              }
            />
          )}
        </form.AppField>
      </View>

      <form.Subscribe selector={(s) => s.values.password}>
        {(password) => <PasswordChecklist password={password} />}
      </form.Subscribe>

      <View className="mb-4">
        <form.AppField name="confirmPassword">
          {(field) => (
            <field.Input
              placeholder="Confirm password"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              leftIcon={<Lock size={18} color={mutedFg} strokeWidth={1.8} />}
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
            loadingLabel="Setting password"
            size="lg"
            className="mb-3 rounded-2xl"
          >
            <Text>Continue</Text>
          </Button>
        )}
      </form.Subscribe>
    </>
  );
}
