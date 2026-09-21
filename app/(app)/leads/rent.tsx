import { Stack } from 'expo-router';
import { LeadsBrowseScreen } from '@/features/leads/components/browse/LeadsBrowseScreen';

export default function RentRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LeadsBrowseScreen config={{ mode: 'intent', intentBucket: 'rent', title: 'Rent Leads' }} />
    </>
  );
}
