import { Redirect, useLocalSearchParams } from 'expo-router';

import { BroadcastScreen } from '@/features/chat/components/contacts/BroadcastScreen';
import { CHAT_WHATSAPP_CONTACTS, useRequirePermission } from '@/lib/rbac';

export default function BroadcastRoute() {
  const { contactIds } = useLocalSearchParams<{ contactIds?: string }>();
  const state = useRequirePermission(CHAT_WHATSAPP_CONTACTS);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return <BroadcastScreen contactIds={contactIds ?? ''} />;
}
