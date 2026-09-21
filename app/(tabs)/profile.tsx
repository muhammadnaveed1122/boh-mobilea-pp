import { Redirect } from 'expo-router';
import { ProfileScreen } from '@/features/profile/components/ProfileScreen';
import { useAuthStore } from '@/store/auth.store';

export default function ProfileRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/" />;
  return <ProfileScreen />;
}
