import { useLocalSearchParams } from 'expo-router';

import { ConversationDetailsScreen } from '@/features/chat/components/details/ConversationDetailsScreen';

export default function ConversationDetailsRoute() {
  const { conversationId, channel, leadId } = useLocalSearchParams<{
    conversationId: string;
    channel: string;
    leadId?: string;
  }>();
  return (
    <ConversationDetailsScreen
      conversationId={conversationId}
      channel={channel}
      leadId={leadId && leadId !== '' ? leadId : undefined}
    />
  );
}
