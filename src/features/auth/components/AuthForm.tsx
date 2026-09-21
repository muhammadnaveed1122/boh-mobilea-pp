import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { Checkbox } from '@/components/atoms/Checkbox';
import { APP_LINKS } from '@/config/app-links';
import { useLoginForm } from '@/features/auth/forms/login.form';
import { useSignupForm } from '@/features/auth/forms/signup.form';
import { useAuthStore } from '@/store/auth.store';
import { resendSignupOtp, signinUser, signupUser } from '@/features/auth/services';
import { ApiError } from '@/lib/api-error';
import { ERROR_CODES } from '@/lib/api-types';
import { openSupport } from '@/lib/support';
import { tokens } from '@theme/tokens';
import type { SigninResponse } from '@/types/auth.types';
import type { LoginFormValues } from '@/features/auth/forms/login.schema';
import type { SignupFormValues } from '@/features/auth/forms/signup.schema';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;

function splitName(full: string): { firstName: string; lastName?: string } {
  const parts = full.trim().split(/\s+/);
  const [first, ...rest] = parts;
  const lastName = rest.join(' ');
  return {
    firstName: first ?? '',
    lastName: lastName === '' ? undefined : lastName,
  };
}

async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // No handler for URL — silent no-op.
  }
}

/** Latest DOB allowed for an 18-year-old (caps the picker; schema is source of truth). */
function eighteenYearsAgo(): Date {
  const now = new Date();
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
}

interface AuthFormProps {
  /**
   * Called after the user is fully authenticated (email/password).
   * Defaults to navigating into the app. The in-place AuthPromptModal passes a
   * handler that just closes the modal so the user stays on their current page.
   */
  onAuthSuccess?: () => void;
  /**
   * Called before navigating to an auth-sheet route (forgot password, MFA
   * verify). When AuthForm is hosted inside a Dialog/modal, the host passes a
   * close handler so the dialog dismisses before the auth sheet appears.
   */
  onNavigateAway?: () => void;
  /**
   * Called when the user taps the back arrow to return to the method chooser.
   * When omitted, no back arrow renders.
   */
  onBack?: () => void;
}

export function AuthForm({ onAuthSuccess, onNavigateAway, onBack }: Readonly<AuthFormProps>) {
  const router = useRouter();
  const handleAuthSuccess = () => {
    if (onAuthSuccess) onAuthSuccess();
    else router.replace('/');
  };
  const setAuth = useAuthStore((s) => s.setAuth);
  const setMfaChallenge = useAuthStore((s) => s.setMfaChallenge);
  const setPendingSignup = useAuthStore((s) => s.setPendingSignup);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [signinError, setSigninError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);

  function routeSigninResponse(response: SigninResponse): void {
    if ('requiresMfa' in response) {
      setMfaChallenge({ tempToken: response.tempToken, keepMeLoggedIn: response.keepMeLoggedIn });
      onNavigateAway?.();
      router.push('/(auth)/mfa-verify');
      return;
    }
    if ('requiresReactivation' in response) {
      // Soft-deleted account: a reactivation OTP was emailed. Route to the OTP
      // screen (reactivation flow) to verify and restore the account.
      setPendingSignup({
        email: response.email,
        resendAvailableAt: response.resendAvailableAt,
        flow: 'reactivation',
      });
      onNavigateAway?.();
      router.push('/(auth)/verify-signup-otp');
      return;
    }
    setAuth(response.user, response.tokens);
    handleAuthSuccess();
  }

  const loginForm = useLoginForm(async (values: LoginFormValues) => {
    setSigninError(null);
    try {
      const response = await signinUser({
        identifier: values.email,
        password: values.password,
        includeUserData: true,
        keepMeLoggedIn: values.keepLoggedIn,
      });
      console.log(
        '[auth] signin response',
        // Drop the permissions array — it drowns out the rest of the payload.
        JSON.stringify(response, (key, value) => (key === 'permissions' ? undefined : value), 2),
      );
      routeSigninResponse(response);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (
        err?.code === ERROR_CODES.ACCOUNT_INACTIVE ||
        err?.code === ERROR_CODES.ACCOUNT_DEACTIVATED ||
        err?.code === ERROR_CODES.ACCOUNT_SUSPENDED
      ) {
        Alert.alert(
          'Account Unavailable',
          'Your account has been disabled or deleted. Please contact support for help.',
          [
            { text: 'Contact Support', onPress: () => void openSupport() },
            { text: 'OK', style: 'cancel' },
          ],
        );
        return;
      }
      if (err?.code === 'ACCOUNT_SETUP_INCOMPLETE') {
        try {
          const res = await resendSignupOtp(values.email);
          setPendingSignup({
            email: values.email,
            resendAvailableAt: res.resendAvailableAt,
            flow: 'signup',
          });
          onNavigateAway?.();
          router.push('/(auth)/verify-signup-otp');
          return;
        } catch (resendErr) {
          const resendApiErr = resendErr instanceof ApiError ? resendErr : null;
          setSigninError(
            resendApiErr?.message ?? 'Your account needs verification. Please try again.',
          );
          return;
        }
      }
      setSigninError(err?.message ?? 'Sign in failed. Please try again.');
    }
  });

  const signupForm = useSignupForm(async (values: SignupFormValues) => {
    setSignupError(null);
    const { firstName, lastName } = splitName(values.name);
    try {
      const res = await signupUser({
        firstName,
        lastName,
        email: values.email,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth,
        termsAccepted: values.termsAccepted,
      });
      setPendingSignup({
        email: values.email,
        resendAvailableAt: res.resendAvailableAt,
        flow: 'signup',
      });
      onNavigateAway?.();
      router.push('/(auth)/verify-signup-otp');
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      // An unfinished signup resumes server-side and lands in the try block above, so this
      // only fires for an account that already has a password — that user wants to sign in.
      if (err?.code === 'ACCOUNT_ALREADY_ACTIVE') {
        setTab('signin');
        setSigninError(err.message);
        return;
      }
      setSignupError(err?.message ?? 'Sign up failed. Please try again.');
    }
  });

  return (
    <>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          className="mb-2 h-9 w-9 items-center justify-center self-start"
        >
          <ArrowLeft size={22} color={`rgb(${tokens.light['--foreground']})`} strokeWidth={1.8} />
        </Pressable>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')}>
        <TabsList className="mb-6">
          <TabsTrigger value="signin">
            <Text>Sign In</Text>
          </TabsTrigger>
          <TabsTrigger value="signup">
            <Text>Sign Up</Text>
          </TabsTrigger>
        </TabsList>

        <AnimatedSwitcher
          active={tab}
          panels={{
            signin: (
              <>
                <Text className="mb-1 text-center text-2xl font-bold text-foreground">Sign In</Text>
                <Text className="mb-6 text-center text-sm text-muted-foreground">
                  Enter your email and password to Sign in!
                </Text>
                <SigninFields
                  form={loginForm}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword((v) => !v)}
                  error={signinError}
                  onForgotPassword={() => {
                    onNavigateAway?.();
                    router.push('/(auth)/forgot-password');
                  }}
                />
              </>
            ),
            signup: (
              <>
                <Text className="mb-1 text-center text-2xl font-bold text-foreground">Sign Up</Text>
                <Text className="mb-6 text-center text-sm text-muted-foreground">
                  Create a new account to get started!
                </Text>
                <SignupFields form={signupForm} error={signupError} />
              </>
            ),
          }}
        />
      </Tabs>
    </>
  );
}

// ---------- Sign In Fields ----------

interface SigninFieldsProps {
  form: ReturnType<typeof useLoginForm>;
  showPassword: boolean;
  onTogglePassword: () => void;
  error: string | null;
  onForgotPassword: () => void;
}

function SigninFields({
  form,
  showPassword,
  onTogglePassword,
  error,
  onForgotPassword,
}: Readonly<SigninFieldsProps>) {
  return (
    <>
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

      <View className="mb-4">
        <form.AppField name="password">
          {(field) => (
            <field.Input
              placeholder="Password"
              secureTextEntry={!showPassword}
              autoComplete="password"
              leftIcon={<Lock size={18} color={mutedFg} strokeWidth={1.8} />}
              rightElement={
                <Pressable onPress={onTogglePassword} hitSlop={8}>
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

      <View className="mb-5 flex-row items-center justify-between">
        <form.AppField name="keepLoggedIn">
          {(field) => <field.Checkbox label="Keep me logged in" />}
        </form.AppField>
        <Pressable hitSlop={8} onPress={onForgotPassword}>
          <Text className="text-sm font-semibold text-primary">Forgot Password?</Text>
        </Pressable>
      </View>

      {error ? <Text className="mb-3 text-center text-sm text-destructive">{error}</Text> : null}

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button
            onPress={form.handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            loadingLabel="Signing in"
            size="lg"
            className="mb-5 rounded-2xl"
          >
            <Text>Sign In</Text>
          </Button>
        )}
      </form.Subscribe>
    </>
  );
}

// ---------- Sign Up Fields ----------

interface SignupFieldsProps {
  form: ReturnType<typeof useSignupForm>;
  error: string | null;
}

function SignupFields({ form, error }: Readonly<SignupFieldsProps>) {
  return (
    <>
      {/* Name */}
      <View className="mb-3">
        <form.AppField name="name">
          {(field) => (
            <field.Input
              placeholder="Name"
              autoCapitalize="words"
              autoComplete="name"
              leftIcon={<User size={18} color={mutedFg} strokeWidth={1.8} />}
            />
          )}
        </form.AppField>
      </View>

      {/* Email */}
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

      {/* Phone */}
      <View className="mb-3">
        <form.AppField name="phone">
          {(field) => <field.PhoneInput defaultCode="AE" placeholder="Phone number" />}
        </form.AppField>
      </View>

      {/* Date of birth */}
      <View className="mb-3">
        <form.AppField name="dateOfBirth">
          {(field) => (
            <field.DatePicker placeholder="Date of birth" maximumDate={eighteenYearsAgo()} />
          )}
        </form.AppField>
      </View>

      {/* Terms & Conditions / Privacy Policy consent */}
      <View className="mb-6">
        <form.AppField name="termsAccepted">
          {(field) => {
            const showError = field.state.meta.isDirty && field.state.meta.errors.length > 0;
            return (
              <>
                <View className="flex-row items-center gap-3">
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(next) => field.handleChange(next)}
                  />
                  <Text className="shrink text-sm text-foreground">
                    I agree to the{' '}
                    <Text
                      className="text-sm font-semibold text-primary"
                      onPress={() => void openLink(APP_LINKS.termsAndConditions)}
                    >
                      Terms & Conditions
                    </Text>{' '}
                    and{' '}
                    <Text
                      className="text-sm font-semibold text-primary"
                      onPress={() => void openLink(APP_LINKS.privacyPolicy)}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
                {showError ? (
                  <Text variant="error" className="mt-1">
                    You must agree to the Terms & Conditions and Privacy Policy
                  </Text>
                ) : null}
              </>
            );
          }}
        </form.AppField>
      </View>

      {error ? <Text className="mb-3 text-center text-sm text-destructive">{error}</Text> : null}

      <form.Subscribe
        selector={(s) => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
          dob: s.values.dateOfBirth,
          terms: s.values.termsAccepted,
        })}
      >
        {({ canSubmit, isSubmitting, dob, terms }) => (
          <Button
            onPress={form.handleSubmit}
            disabled={!canSubmit || dob.length === 0 || !terms}
            loading={isSubmitting}
            loadingLabel="Creating account"
            size="lg"
            className="mb-5 rounded-2xl"
          >
            <Text>Sign Up</Text>
          </Button>
        )}
      </form.Subscribe>
    </>
  );
}

// ---------- Animated Switcher ----------

interface AnimatedSwitcherProps {
  active: string;
  panels: Record<string, ReactNode>;
}

function AnimatedSwitcher({ active, panels }: Readonly<AnimatedSwitcherProps>) {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const h = useSharedValue(0);
  const target = heights[active];

  useEffect(() => {
    if (target && target > 0) {
      if (h.value === 0) {
        h.value = target;
      } else {
        h.value = withTiming(target, { duration: 160, easing: Easing.out(Easing.cubic) });
      }
    }
  }, [target, h]);

  const style = useAnimatedStyle(() => ({
    height: h.value === 0 ? undefined : h.value,
  }));

  function handleLayout(key: string) {
    return (e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.height;
      setHeights((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    };
  }

  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]}>
      {Object.entries(panels).map(([key, node]) => {
        const isActive = key === active;
        return (
          <View
            key={key}
            onLayout={handleLayout(key)}
            style={{
              position: isActive ? 'relative' : 'absolute',
              left: 0,
              right: 0,
              top: 0,
              opacity: isActive ? 1 : 0,
            }}
            pointerEvents={isActive ? 'auto' : 'none'}
          >
            {node}
          </View>
        );
      })}
    </Animated.View>
  );
}
