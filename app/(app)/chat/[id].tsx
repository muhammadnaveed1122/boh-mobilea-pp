import { Redirect, useLocalSearchParams } from 'expo-router';

import { ConversationScreen } from '@/features/chat';
import { CHAT_READ, useRequirePermission } from '@/lib/rbac';

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useRequirePermission(CHAT_READ);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return <ConversationScreen conversationId={id} unified={false} />;
}
