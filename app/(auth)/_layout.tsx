import { useEffect } from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { clearPendingLink, peekPendingLink } from '@/lib/pending-link';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const pathname = usePathname();

  // Onboarding lives under (auth) but is not an auth-gated screen. Allow it
  // through even when authenticated — otherwise users with persisted Keychain
  // tokens but wiped AsyncStorage (iOS reinstall) hit a redirect loop with
  // (app)/_layout, which redirects unseen-onboarding back here.
  const onOnboarding = pathname.endsWith('/onboarding');

  // A deep link that landed before the session was usable was parked by `+native-intent`; every
  // route to this screen (cold start mid-hydration, or a genuinely signed-out tap) funnels through
  // the redirect below, so this is the one place that can honour it. Peeking rather than consuming
  // keeps the target identical on every render — a value that changed mid-flight would let this
  // redirect race itself. The unmount cleanup drops it once the redirect has carried the user away,
  // so it can never resurface on a later sign-in.
  useEffect(() => clearPendingLink, []);

  if (isAuthenticated && hasSeenOnboarding !== false && !onOnboarding) {
    return <Redirect href={(peekPendingLink() ?? '/') as never} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
