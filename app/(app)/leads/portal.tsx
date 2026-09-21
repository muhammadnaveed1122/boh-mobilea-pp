import { Stack } from 'expo-router';
import { LeadsBrowseScreen } from '@/features/leads/components/browse/LeadsBrowseScreen';

export default function PortalRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LeadsBrowseScreen config={{ mode: 'portal', title: 'Portal Leads' }} />
    </>
  );
}
