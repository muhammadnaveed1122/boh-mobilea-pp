import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setMessageReaction } from '../api/services';
import type { Message, ReactionAggregate } from '../models/message';
import { chatKeys } from './keys';

/**
 * Apply WhatsApp-parity semantics to a cached `Message.reactions` array. The
 * caller's existing reaction (if any) is the row with `mine: true`. Same
 * emoji as the existing → remove; different → swap; empty → just remove.
 * Pure function so it can be reused for both optimistic mutate + rollback.
 */
function applyReactionToMessage(message: Message, emoji: string): Message {
  const current = message.reactions ?? [];
  const mine = current.find((r) => r.mine);
  let next: ReactionAggregate[] = current.map((r) => ({ ...r }));

  // Remove the caller's prior reaction (decrement count, drop if zero).
  if (mine) {
    next = next.flatMap((r) => {
      if (!r.mine) return [r];
      const nextCount = r.count - 1;
      return nextCount > 0 ? [{ ...r, count: nextCount, mine: false }] : [];
    });
  }

  const isRemoval = emoji === '' || mine?.emoji === emoji;
  if (!isRemoval) {
    const existing = next.find((r) => r.emoji === emoji);
    if (existing) {
      next = next.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
    } else {
      next.push({ emoji, count: 1, mine: true });
    }
  }

  next.sort((a, b) => b.count - a.count);

  return { ...message, reactions: next.length > 0 ? next : undefined };
}

function applyToList(
  list: Message[] | undefined,
  messageId: string,
  emoji: string,
): Message[] | undefined {
  if (!list) return list;
  return list.map((m) => (m.id === messageId ? applyReactionToMessage(m, emoji) : m));
}

/**
 * Optimistic reaction mutation. Mutates the cached `messages` list for the
 * current conversation immediately; rolls back on error; re-syncs on settle.
 */
export function useSetReaction(conversationId: string) {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { messageId: string; emoji: string },
    { prev: Message[] | undefined }
  >({
    mutationFn: ({ messageId, emoji }) => setMessageReaction(messageId, emoji),
    onMutate: async ({ messageId, emoji }) => {
      const key = chatKeys.messages(conversationId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Message[]>(key);
      qc.setQueryData<Message[]>(key, (list) => applyToList(list, messageId, emoji));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(chatKeys.messages(conversationId), ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
    },
  });
}
