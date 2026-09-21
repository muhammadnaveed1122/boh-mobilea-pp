import { useQuery } from '@tanstack/react-query';

import { getMessages } from '../api/services';
import { toMessages } from '../api/transforms';
import type { Message } from '../models/message';
import { chatKeys } from './keys';

/** All messages (unfiltered) for the shared-media grid. Shares the chat cache. */
export function useConversationMedia(conversationId: string) {
  return useQuery<Message[]>({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async () => toMessages(await getMessages(conversationId)),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}
