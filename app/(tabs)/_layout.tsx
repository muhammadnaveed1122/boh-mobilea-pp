import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { BottomTabBar } from '@/features/new-projects/components/BottomTabBar';
import { MOBILE_BLOCKED_ROLES } from '@/lib/rbac';
import { hasAnyRole } from '@/lib/rbac/selectors';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const { hasSeenOnboarding, loadOnboardingState } = useOnboardingStore();

  useEffect(() => {
    loadOnboardingState();
  }, [loadOnboardingState]);

  if (hasSeenOnboarding === null) return null;
  if (!hasSeenOnboarding) return <Redirect href="/(auth)/onboarding" />;

  // Blocked-roles gate mirrors (app)/_layout. NO isAuthenticated redirect here:
  // home (index) is public; authed-only tabs carry their own guards.
  if (
    user &&
    !user.hasAllAccess &&
    MOBILE_BLOCKED_ROLES.length > 0 &&
    hasAnyRole(user, MOBILE_BLOCKED_ROLES)
  ) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar state={props.state} navigation={props.navigation} />}
      // freezeOnBlur intentionally OFF: with all tabs mounted, freeze/unfreeze
      // churn on every switch re-renders the full screen tree per hop and can
      // stall rapid tab switching (worst in dev). Hidden tabs are still
      // detached from the native view hierarchy by react-native-screens.
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="listings" />
      <Tabs.Screen name="leads" />
      <Tabs.Screen name="calls" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="favourites" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
