import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { LocationPicker } from '@/features/chat/components/LocationPicker';

// No permission guard here: this screen is only reachable from the conversation
// composer, whose send is already channel-gated. Location always sends on
// WhatsApp, so the composer's WhatsApp gate covers it — a separate check would
// be redundant.
export default function LocationPickerRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <LocationPicker conversationId={conversationId} onDone={() => router.back()} />
    </>
  );
}
