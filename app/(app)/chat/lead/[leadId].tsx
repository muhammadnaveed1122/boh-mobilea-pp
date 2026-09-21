import { Redirect, useLocalSearchParams } from 'expo-router';

import { LeadConversationGate } from '@/features/chat';
import { CHAT_READ, useRequirePermission } from '@/lib/rbac';

export default function LeadConversationRoute() {
  const { leadId, phone, name, email } = useLocalSearchParams<{
    leadId: string;
    phone?: string;
    name?: string;
    email?: string;
  }>();
  const state = useRequirePermission(CHAT_READ);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return (
    <LeadConversationGate
      leadId={leadId}
      leadName={name ?? 'this lead'}
      phone={phone ?? ''}
      email={email ?? ''}
    />
  );
}
