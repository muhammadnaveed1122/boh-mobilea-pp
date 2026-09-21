import { useQuery } from '@tanstack/react-query';

import { getConversations } from '../api/services';
import { toChatContact } from '../api/transforms';
import type { ApiConversation } from '../api/types';
import { isMessengerChannel } from '../models/channel';
import type { ChatContact } from '../models/conversation';
import { chatKeys } from './keys';

/** Inbox top-tab selector. `all` shows every channel. */
export type InboxTab = 'all' | 'whatsapp' | 'messenger';

/** Whether a conversation row is a Messenger thread. */
function isMessengerRow(c: ApiConversation): boolean {
  return isMessengerChannel(c.channel);
}

/** Keep only the rows belonging to the active tab. */
function matchesTab(c: ApiConversation, tab: InboxTab): boolean {
  switch (tab) {
    case 'messenger':
      return isMessengerRow(c);
    case 'whatsapp':
      return !isMessengerRow(c);
    default:
      return true;
  }
}

/**
 * Inbox conversations as contact rows, newest first. `tab` filters the list:
 * `all` (default) shows every channel, `whatsapp` folds in WhatsApp + email
 * threads, and `messenger` shows only Messenger threads.
 */
export function useChatInbox(tab: InboxTab = 'all') {
  return useQuery<ApiConversation[], Error, ChatContact[]>({
    queryKey: chatKeys.conversations(),
    queryFn: getConversations,
    select: (rows) =>
      [...rows]
        .filter((c) => matchesTab(c, tab))
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
        )
        .map((c) => toChatContact(c)),
  });
}
