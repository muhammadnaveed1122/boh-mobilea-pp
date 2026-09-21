import { Redirect } from 'expo-router';

import { ChatInboxScreen } from '@/features/chat';
import { CHAT_READ, useRequirePermission } from '@/lib/rbac';

export default function ChatInboxRoute() {
  const state = useRequirePermission(CHAT_READ);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;

  return <ChatInboxScreen />;
}
