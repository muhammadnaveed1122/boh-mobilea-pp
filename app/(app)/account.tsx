import { ProfileScreen } from '@/features/profile/components/ProfileScreen';

// Staff profile, pushed over the tabs like any detail screen. Customers use
// the /profile tab instead (their tab set includes Profile, so the bar
// highlight stays in sync); staff tab sets have no Profile button, so a tab
// jump would leave the bar with nothing highlighted.
export default function AccountRoute() {
  return <ProfileScreen showBackHeader />;
}
