import { Stack } from 'expo-router';
import { LeadsBrowseScreen } from '@/features/leads/components/browse/LeadsBrowseScreen';

export default function BuyRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LeadsBrowseScreen config={{ mode: 'intent', intentBucket: 'buy', title: 'Buy Leads' }} />
    </>
  );
}
