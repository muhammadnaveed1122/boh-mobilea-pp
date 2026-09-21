/**
 * LeadConversationGate — resolves a lead's single unified conversation and
 * branches: a conversation that already has messages renders the normal
 * ConversationScreen (WhatsApp + email in one thread); otherwise
 * StartConversation lets the user pick a channel to bootstrap one. The by-lead
 * endpoint returns a bare conversation with no message metadata, so message
 * presence is probed separately. After the first message is sent the chat
 * caches are invalidated, this re-resolves, and ConversationScreen mounts.
 */

import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useConversationHasMessages } from '../hooks/use-conversation-has-messages';
import { useLeadConversation } from '../hooks/use-lead-conversation';
import { ConversationScreen } from './ConversationScreen';
import { StartConversation } from './StartConversation';

interface LeadConversationGateProps {
  leadId: string;
  leadName: string;
  phone: string;
  email: string;
}

export function LeadConversationGate({
  leadId,
  leadName,
  phone,
  email,
}: Readonly<LeadConversationGateProps>) {
  const primary = useThemeColor('--primary');
  const insets = useSafeAreaInsets();
  const convQuery = useLeadConversation(leadId);
  const conv = convQuery.data ?? null;
  const messagesQuery = useConversationHasMessages(conv?.id);

  const isLoading = convQuery.isLoading || (!!conv && messagesQuery.isLoading);
  const isError = convQuery.isError || (!!conv && messagesQuery.isError);

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background px-6"
        style={{ paddingTop: insets.top }}
      >
        <EmptyState icon="CircleAlert" title="Couldn't load conversation" />
        <Pressable
          onPress={() => {
            convQuery.refetch().catch(() => {});
            messagesQuery.refetch().catch(() => {});
          }}
          accessibilityRole="button"
          className="mt-4 rounded-full bg-primary px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (conv && messagesQuery.data) {
    return <ConversationScreen conversationId={conv.id} />;
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <StartConversation leadId={leadId} leadName={leadName} phone={phone} email={email} />
    </View>
  );
}
