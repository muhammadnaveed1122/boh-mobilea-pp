import { SuperAdminDashboardScreen } from '@/features/dashboard/components/SuperAdminDashboardScreen';
import { useDashboardAccess } from '@/features/dashboard/hooks/use-dashboard-access';
import { HomeDashboardScreen } from '@/features/home/components/HomeDashboardScreen';
import { HomeScreen } from '@/features/new-projects/components/HomeScreen';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';

// Root `/`. Logged-in staff (agents/managers/etc) land on the staff home
// dashboard; the leads dashboard lives on the Leads tab. Everyone else —
// unauth, portal accounts (`client`/`owner`), tenants, and the `customer`
// role — keeps Project Listings as home. Gating on `client` alone used to drop
// social sign-ins whose account had been promoted to `owner` onto the staff
// dashboard, where zero permissions rendered a blank screen.
//
// Super-admins AND any role listed in EXPO_PUBLIC_DASHBOARD_ROLE_IDS (the CEO
// "Full Access" role in production) get the six-tile dashboard instead of the
// staff home. That is a routing decision — which dashboard renders — not a
// permission gate; RBAC.md forbids the latter, and the backend's
// DashboardAccessGuard is what actually enforces access to the data.
export default function HomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isEndUserShell } = useRole();
  const canSeeDashboard = useDashboardAccess();

  if (!isAuthenticated || isEndUserShell) return <HomeScreen />;
  if (canSeeDashboard) return <SuperAdminDashboardScreen />;
  return <HomeDashboardScreen />;
}
