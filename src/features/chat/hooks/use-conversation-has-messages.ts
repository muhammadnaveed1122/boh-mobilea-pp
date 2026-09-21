import { useQuery } from '@tanstack/react-query';

import { getMessages } from '../api/services';
import { chatKeys } from './keys';

/**
 * Probes whether a resolved conversation already has any messages. The by-lead
 * endpoint returns no message metadata, so message presence must be fetched.
 * Uses a key distinct from `chatKeys.messages(id)` to avoid colliding with the
 * transformed message cache used by `useConversation`.
 */
export function useConversationHasMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: [...chatKeys.conversation(conversationId ?? ''), 'has-messages'] as const,
    queryFn: async () => (await getMessages(conversationId as string)).length > 0,
    enabled: !!conversationId,
  });
}
