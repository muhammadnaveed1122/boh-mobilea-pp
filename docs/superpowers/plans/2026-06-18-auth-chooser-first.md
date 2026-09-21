# Chooser-first Auth Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an auth method chooser (Apple / Google / email) before any email/password fields, in both the full-screen login and the in-app prompt modal.

**Architecture:** Extract social sign-in into a new `AuthChooser`. Strip social out of `AuthForm` (becomes email/password tabs + a back arrow). A new shared `AuthFlow` holds a `view: 'chooser' | 'form'` state and renders one or the other, intercepting Android hardware back to return form → chooser. Both `login.tsx` and `AuthPromptModal` render `AuthFlow`.

**Tech Stack:** Expo Router, React Native 0.81, React 19, TypeScript (strict), NativeWind v4, Zustand, lucide-react-native.

## Global Constraints

- No test runner exists. Verify every task with: `pnpm exec tsc --noEmit` (zero errors) and `pnpm lint` (zero errors), then manual QA. Do NOT add a test runner or test files.
- Package manager is **pnpm**. Never use npm/yarn.
- Strict TypeScript. Component prop types use `Readonly<{...}>`.
- Styling via semantic NativeWind tokens only (`bg-background`, `text-foreground`, `border-border`, `text-destructive`, `text-muted-foreground`). No hard-coded hex. `prettier-plugin-tailwindcss` auto-sorts classes — don't hand-order.
- Path aliases: `@/*` → `src/*`, `@theme` → `theme/`.
- Always go through the Zustand auth store (`setAuth`) — never mutate the axios token directly.
- Apple button is iOS-only, gated by `isAppleSignInAvailable()`.
- Backend endpoints and request/response shapes are unchanged.

---

## File Structure

- Create: `src/features/auth/components/AuthChooser.tsx` — method picker; owns Apple/Google sign-in logic + the "Sign in with email" button.
- Create: `src/features/auth/components/AuthFlow.tsx` — holds `view` state, renders chooser or form, handles Android back.
- Modify: `src/features/auth/components/AuthForm.tsx` — remove social section + handlers; add `onBack` prop + back arrow; default Sign In tab (already default).
- Modify: `app/(auth)/login.tsx` — render `AuthFlow` inside `AuthSheet`.
- Modify: `src/features/auth/components/AuthPromptModal.tsx` — render `AuthFlow` inside `Dialog`.

---

## Task 1: AuthChooser component

**Files:**

- Create: `src/features/auth/components/AuthChooser.tsx`

**Interfaces:**

- Produces: `AuthChooser({ onEmailPress, onAuthSuccess, onNavigateAway? }: Readonly<AuthChooserProps>)` where
  `AuthChooserProps = { onEmailPress: () => void; onAuthSuccess?: () => void; onNavigateAway?: () => void }`.
  `onEmailPress` switches the parent to the form view. `onAuthSuccess` runs after a successful social sign-in (defaults to `router.replace('/')`).

- [ ] **Step 1: Create the file**

This moves the social logic verbatim out of `AuthForm` (handlers at current `AuthForm.tsx:109-141`, the availability effect at `102-107`, and the JSX at `292-314`), and adds the email button.

```tsx
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
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

      {/* Email — switches the flow to the tabbed sign in / sign up form */}
      <Pressable
        onPress={onEmailPress}
        className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background"
      >
        <Mail size={18} color={mutedFg} strokeWidth={1.8} />
        <Text className="text-base font-semibold text-foreground">Sign in with email</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (The component is not yet referenced; this only proves it compiles.)

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/components/AuthChooser.tsx
git commit -m "feat(auth): add AuthChooser method picker component"
```

---

## Task 2: Strip social from AuthForm, add back arrow

**Files:**

- Modify: `src/features/auth/components/AuthForm.tsx`

**Interfaces:**

- Consumes: nothing new.
- Produces: `AuthForm` gains `onBack?: () => void`. Full props become
  `{ onAuthSuccess?: () => void; onNavigateAway?: () => void; onBack?: () => void }`.
  When `onBack` is set, a back arrow renders top-left and invokes it.

- [ ] **Step 1: Replace the imports block (lines 1-40)**

Remove the social imports (`Platform`, the google/apple sign-in modules, the two social button components, and `signinWithAppleIdToken`/`signinWithGoogleIdToken` from services), and add `ArrowLeft`.

Replace `AuthForm.tsx:1-40` with:

```tsx
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
```

- [ ] **Step 2: Update the props interface (lines 68-81)**

Replace the `AuthFormProps` interface with:

```tsx
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
```

- [ ] **Step 3: Update the component signature and remove social state/handlers (lines 83-141)**

Replace the block from the `export function AuthForm(...)` signature through the end of `handleAppleSignIn` (i.e. `AuthForm.tsx:83-141`) with:

```tsx
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
```

This deletes: the five social state hooks (`googleError`, `isGoogleLoading`, `appleError`, `isAppleLoading`, `appleAvailable`), the `useEffect` Apple-availability check, and both `handleGoogleSignIn` / `handleAppleSignIn` functions. `useEffect` is still imported — it is used by `AnimatedSwitcher` at the bottom of the file.

- [ ] **Step 4: Add the back arrow and remove the social JSX (lines 241-315)**

Replace the `return (...)` JSX of `AuthForm` — from `return (` through the closing `</Tabs>` `);` (i.e. `AuthForm.tsx:241-316`, ending just before `// ---------- Sign In Fields ----------`) with:

```tsx
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
```

This removes the "Or" divider and the Google/Apple button JSX (old lines 285-314). `Mail`, `User`, `Lock`, `Eye`, `EyeOff` icons remain in use by the field components below.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. Confirms no dangling references to the removed handlers/imports.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: no errors (no unused imports/vars).

- [ ] **Step 7: Commit**

```bash
git add src/features/auth/components/AuthForm.tsx
git commit -m "refactor(auth): strip social buttons from AuthForm, add back arrow"
```

---

## Task 3: AuthFlow shared container

**Files:**

- Create: `src/features/auth/components/AuthFlow.tsx`

**Interfaces:**

- Consumes: `AuthChooser` (Task 1) and `AuthForm` (Task 2).
- Produces: `AuthFlow({ onAuthSuccess, onNavigateAway }: Readonly<AuthFlowProps>)` where
  `AuthFlowProps = { onAuthSuccess?: () => void; onNavigateAway?: () => void }`.
  Renders the chooser by default; switches to the form on email tap; back arrow / Android hardware back returns to chooser.

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { AuthChooser } from '@/features/auth/components/AuthChooser';
import { AuthForm } from '@/features/auth/components/AuthForm';

type AuthView = 'chooser' | 'form';

interface AuthFlowProps {
  /** Forwarded to social + email sign-in success (defaults to entering the app). */
  onAuthSuccess?: () => void;
  /** Forwarded to AuthForm for pre-navigation cleanup (modal close). */
  onNavigateAway?: () => void;
}

/**
 * Chooser-first auth container. Shows the method picker, then swaps to the
 * tabbed email/password form when the user chooses email. Shared by the
 * full-screen login screen and the in-app AuthPromptModal.
 */
export function AuthFlow({ onAuthSuccess, onNavigateAway }: Readonly<AuthFlowProps>) {
  const [view, setView] = useState<AuthView>('chooser');

  // Android hardware back: from the form, return to the chooser instead of
  // leaving the auth surface. From the chooser, fall through to default.
  useEffect(() => {
    if (view !== 'form') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('chooser');
      return true;
    });
    return () => sub.remove();
  }, [view]);

  if (view === 'form') {
    return (
      <AuthForm
        onAuthSuccess={onAuthSuccess}
        onNavigateAway={onNavigateAway}
        onBack={() => setView('chooser')}
      />
    );
  }

  return <AuthChooser onEmailPress={() => setView('form')} onAuthSuccess={onAuthSuccess} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/components/AuthFlow.tsx
git commit -m "feat(auth): add AuthFlow chooser/form container with Android back handling"
```

---

## Task 4: Wire both entry points to AuthFlow

**Files:**

- Modify: `app/(auth)/login.tsx`
- Modify: `src/features/auth/components/AuthPromptModal.tsx`

**Interfaces:**

- Consumes: `AuthFlow` (Task 3).

- [ ] **Step 1: Update login.tsx**

Replace the entire contents of `app/(auth)/login.tsx` with:

```tsx
import { useRouter } from 'expo-router';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { AuthFlow } from '@/features/auth/components/AuthFlow';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const skipAuth = useAuthStore((s) => s.skipAuth);

  function handleSkip() {
    skipAuth();
    router.replace('/');
  }

  return (
    <AuthSheet onSkip={handleSkip}>
      <AuthFlow />
    </AuthSheet>
  );
}
```

- [ ] **Step 2: Update AuthPromptModal.tsx**

Replace the entire contents of `src/features/auth/components/AuthPromptModal.tsx` with:

```tsx
import { useEffect } from 'react';
import { Dialog } from '@/components/atoms/Dialog';
import { AuthFlow } from '@/features/auth/components/AuthFlow';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';

export function AuthPromptModal() {
  const isOpen = useAuthPromptStore((s) => s.isOpen);
  const close = useAuthPromptStore((s) => s.close);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      close();
    }
  }, [isOpen, isAuthenticated, close]);

  return (
    <Dialog visible={isOpen} onRequestClose={close} scrollable>
      <AuthFlow onAuthSuccess={close} onNavigateAway={close} />
    </Dialog>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/login.tsx" src/features/auth/components/AuthPromptModal.tsx
git commit -m "feat(auth): render chooser-first AuthFlow in login screen and prompt modal"
```

---

## Task 5: Manual QA pass

**Files:** none (verification only).

No automated tests in this repo — validate behavior by hand on both platforms where possible.

- [ ] **Step 1: Full typecheck + lint gate**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: both clean.

- [ ] **Step 2: Run the app**

Run: `pnpm ios` (and/or `pnpm android`).

- [ ] **Step 3: Walk the checklist**

Verify each:

- Cold start → **chooser** shows; no email/password fields visible.
- Chooser shows Google + "Sign in with email"; on iOS also Apple (above Google).
- Tap **Google** → completes sign-in → enters app. (Apple likewise on iOS.)
- Tap **Sign in with email** → form view, **Sign In** tab active by default; tabs switch to Sign Up.
- Tap **back arrow** (top-left) → returns to chooser.
- On Android, in form view press **hardware back** → returns to chooser (does not exit auth). In chooser view, hardware back behaves as before.
- **Skip** (full-screen) dismisses the sheet and enters guest mode.
- Guest taps the Favorite ❤️ (or Favourites/Profile tab) → **AuthPromptModal** opens on the chooser → same chooser → email → form → back all work; modal closes on successful sign-in.
- Forgot password / signup → OTP route still navigates correctly from the form.

- [ ] **Step 4: Commit (only if QA-driven fixes were needed)**

```bash
git add -A
git commit -m "fix(auth): chooser-first QA adjustments"
```

---

## Self-Review

- **Spec coverage:** Chooser-first entry (Tasks 1,3,4) ✓; keep tabs / Sign In default (Task 2) ✓; state toggle, no new route (Task 3) ✓; social only on chooser (Tasks 1,2) ✓; back arrow + Android back (Tasks 2,3) ✓; Skip on chooser/full-screen only (unchanged `AuthSheet`, Task 4) ✓; both entry points via shared component (Task 4) ✓; no backend change ✓; Apple-unavailable hidden via `isAppleSignInAvailable()` (Task 1) ✓.
- **Type consistency:** `onAuthSuccess` / `onNavigateAway` / `onBack` signatures match across `AuthChooser`, `AuthForm`, `AuthFlow`. `setAuth(response.user, response.tokens)` usage unchanged. `view: 'chooser' | 'form'` consistent.
- **Placeholder scan:** none — all steps carry full code.
