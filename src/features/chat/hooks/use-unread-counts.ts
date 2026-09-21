import { useQuery } from '@tanstack/react-query';

import { CHAT_READ, useCan } from '@/lib/rbac';

import { getConversations } from '../api/services';
import type { ApiConversation } from '../api/types';
import { isMessengerChannel } from '../models/channel';
import type { InboxTab } from './use-chat-inbox';
import { chatKeys } from './keys';

export type UnreadCounts = Record<InboxTab, number>;

/**
 * Unread badges for the Chat tab and the inbox filter chips.
 *
 * Counts CONVERSATIONS that have unread messages, not the total number of
 * unread messages — this matches the web client's `countUnreadConversations`,
 * so a thread with six unread messages contributes 1 to the badge on both
 * clients rather than 6 on one and 1 on the other.
 *
 * Shares `chatKeys.conversations()` with `useChatInbox`, so mounting this in
 * the tab bar costs no extra request: whichever mounts first fills the cache
 * and both read the same rows through different `select`s.
 *
 * The `whatsapp` bucket deliberately includes email/unified threads. Web keeps
 * email out, but mobile's WhatsApp tab *lists* those threads, so excluding
 * them would badge a number the user cannot reconcile with the list in front
 * of them.
 */
export function useUnreadCounts(): UnreadCounts {
  const canRead = useCan(CHAT_READ);
  const { data } = useQuery<ApiConversation[], Error, UnreadCounts>({
    queryKey: chatKeys.conversations(),
    queryFn: getConversations,
    enabled: canRead,
    select: (rows) => {
      let whatsapp = 0;
      let messenger = 0;
      for (const row of rows) {
        if ((row.unreadCount ?? 0) <= 0) continue;
        if (isMessengerChannel(row.channel)) messenger += 1;
        else whatsapp += 1;
      }
      return { all: whatsapp + messenger, whatsapp, messenger };
    },
  });
  return data ?? { all: 0, whatsapp: 0, messenger: 0 };
}
