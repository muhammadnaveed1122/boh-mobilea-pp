import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getSocket } from '@/lib/socket';

import { toMessage } from '../api/transforms';
import type { ApiMessage } from '../api/types';
import type { Message } from '../models/message';
import { chatKeys } from './keys';

/** Updater passed to setQueryData — appends or replaces `next` in the cached list. */
function applyMessageToCache(prev: Message[] | undefined, next: Message): Message[] {
  const list = prev ?? [];
  if (list.some((m) => m.id === next.id)) {
    return list.map((m) => (m.id === next.id ? next : m));
  }
  return [...list, next];
}

/** Pull a `MessageResource` out of the various socket payload shapes. */
function extractMessage(payload: unknown): ApiMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const candidate =
    obj.message && typeof obj.message === 'object' ? (obj.message as Record<string, unknown>) : obj;
  if (typeof candidate.id === 'string' && typeof candidate.conversationId === 'string') {
    return candidate as unknown as ApiMessage;
  }
  return null;
}

/**
 * Append socket-delivered messages into the active conversation's query cache
 * and refresh the inbox. Safe-net invalidation covers truncated payloads.
 */
export function useChatSocket(conversationId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    if (!socket) return;

    const invalidate = (payload: unknown): void => {
      const msg = extractMessage(payload);
      const affects = !msg || msg.conversationId === conversationId;
      if (affects) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
        qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
        qc.invalidateQueries({ queryKey: chatKeys.whatsappWindow(conversationId) }).catch(() => {});
      }
    };

    const upsert = (payload: unknown): void => {
      const msg = extractMessage(payload);
      if (msg?.conversationId === conversationId) {
        const next = toMessage(msg);
        qc.setQueryData<Message[]>(chatKeys.messages(conversationId), (prev) =>
          applyMessageToCache(prev, next),
        );
      }
      invalidate(payload);
    };

    const NEW_MESSAGE_EVENTS = [
      'message:incoming',
      'message:outgoing',
      'chat:message:new',
      'whatsapp:message:new',
    ] as const;
    const REFRESH_ONLY_EVENTS = [
      'message:status',
      'whatsapp:conversation:update',
      'message:reaction',
    ] as const;

    for (const evt of NEW_MESSAGE_EVENTS) socket.on(evt, upsert);
    for (const evt of REFRESH_ONLY_EVENTS) socket.on(evt, invalidate);
    return () => {
      for (const evt of NEW_MESSAGE_EVENTS) socket.off(evt, upsert);
      for (const evt of REFRESH_ONLY_EVENTS) socket.off(evt, invalidate);
    };
  }, [conversationId, qc]);
}
