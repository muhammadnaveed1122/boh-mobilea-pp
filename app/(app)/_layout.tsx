import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { MOBILE_BLOCKED_ROLES } from '@/lib/rbac';
import { hasAnyRole } from '@/lib/rbac/selectors';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { hasSeenOnboarding, loadOnboardingState } = useOnboardingStore();

  useEffect(() => {
    loadOnboardingState();
  }, [loadOnboardingState]);

  if (hasSeenOnboarding === null) return null;

  if (!hasSeenOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Block only explicitly listed roles (default-allow). Super-admin
  // (hasAllAccess) always passes. Empty user/roles passes through so the
  // app can render during hydration; per-screen guards handle finer checks.
  if (
    user &&
    !user.hasAllAccess &&
    MOBILE_BLOCKED_ROLES.length > 0 &&
    hasAnyRole(user, MOBILE_BLOCKED_ROLES)
  ) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="agents/index" />
      <Stack.Screen name="listings/create" />
      <Stack.Screen name="listings/compare" />
      <Stack.Screen name="leads/buy" />
      <Stack.Screen name="leads/sell" />
      <Stack.Screen name="leads/rent" />
      <Stack.Screen name="leads/portal" />
      <Stack.Screen name="calls/[uuid]" />
      <Stack.Screen name="areas/index" />
      <Stack.Screen name="areas/[id]" />
      <Stack.Screen name="mfa-setup" options={{ presentation: 'modal' }} />
      <Stack.Screen name="mfa-disable" options={{ presentation: 'modal' }} />
      <Stack.Screen name="mfa-regenerate-backup-codes" options={{ presentation: 'modal' }} />
      <Stack.Screen name="leads/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="call/dialpad" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
