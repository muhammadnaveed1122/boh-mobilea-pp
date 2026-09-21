import { Redirect, useLocalSearchParams } from 'expo-router';

import { ChannelScreen } from '@/features/chat/components/contacts/ChannelScreen';
import { CHAT_WHATSAPP_CONTACTS, useRequirePermission } from '@/lib/rbac';

export default function ChannelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useRequirePermission(CHAT_WHATSAPP_CONTACTS);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return <ChannelScreen groupId={id} />;
}
