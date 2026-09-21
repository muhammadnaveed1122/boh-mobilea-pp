import { Stack } from 'expo-router';
import { LeadsBrowseScreen } from '@/features/leads/components/browse/LeadsBrowseScreen';

export default function SellRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LeadsBrowseScreen config={{ mode: 'intent', intentBucket: 'sell', title: 'Sell Leads' }} />
    </>
  );
}
