import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useLeadDetail } from '@/features/leads/hooks/use-lead-detail';
import { ApiError } from '@/lib/api-error';
import { showErrorToast } from '@/lib/toast/toast.store';

import { deleteMessage, getConversation, getMessages, markConversationRead } from '../api/services';
import { formatClockTime, toChatContact, toMessages } from '../api/transforms';
import { CHANNEL_FILTERS, isMessengerChannel } from '../models/channel';
import type { Channel, ChannelFilter } from '../models/channel';
import type { ChatContact } from '../models/conversation';
import type {
  Message,
  MessageLocation,
  MessageMedia,
  MessageReplyRef,
  PickedAsset,
  SendPayload,
} from '../models/message';
import { chatKeys } from './keys';
import { useChatSocket } from './use-chat-socket';
import { useSendMessage } from './use-send-message';
import { useSendMessenger } from './use-send-messenger';
import { useWhatsappWindow } from './use-whatsapp-window';

const TMP_PREFIX = 'tmp_';
let tmpCounter = 0;

/** Monotonic id for an optimistic outbound bubble; not security-sensitive. */
function tmpId(): string {
  tmpCounter += 1;
  return `${TMP_PREFIX}${Date.now()}_${tmpCounter}`;
}

/** Channel-level read/write gate. Email is not chat-permissioned (lead-email path). */
function channelAllowed(
  channel: Channel | ChannelFilter,
  canWhatsapp: boolean,
  canMessenger: boolean,
): boolean {
  if (channel === 'whatsapp') return canWhatsapp;
  if (channel === 'messenger') return canMessenger;
  return true;
}

function markMessageFailed(id: string) {
  return (prev: Message[] | undefined): Message[] =>
    (prev ?? []).map((m) => (m.id === id ? { ...m, status: 'failed' as const } : m));
}

function buildOptimisticMessage(args: {
  id: string;
  channel: Channel;
  text: string;
  subject?: string;
  attachment?: PickedAsset;
  location?: MessageLocation;
  replyTo?: MessageReplyRef;
  now?: Date;
}): Message {
  const now = args.now ?? new Date();
  const media: MessageMedia | undefined = args.attachment
    ? {
        messageId: args.id,
        kind: args.attachment.kind,
        url: args.attachment.uri,
        mimeType: args.attachment.mimeType,
        name: args.attachment.name,
      }
    : undefined;
  return {
    id: args.id,
    channel: args.channel,
    direction: 'out',
    text: args.text,
    subject: args.subject,
    time: formatClockTime(now.toISOString()),
    status: 'pending',
    dayLabel: 'Today',
    ...(media ? { media } : {}),
    ...(args.location ? { location: args.location } : {}),
    ...(args.replyTo ? { replyTo: args.replyTo } : {}),
  };
}

/**
 * A bubble this client sent optimistically, kept until the server's copy of it
 * shows up so the two can be stitched into one row (see `adoptClientKeys`).
 */
interface PendingSend {
  tmpId: string;
  channel: Channel;
  /** Trimmed body/caption, compared against the server copy. */
  text: string;
  hasMedia: boolean;
  hasLocation: boolean;
  /** Local `file:`/`content:` uri, reused so the image doesn't reload. */
  localMediaUrl?: string;
  sentAt: number;
}

/** How long an unmatched optimistic send stays eligible for stitching. */
const PENDING_MATCH_TTL_MS = 5 * 60 * 1000;

function isSameSend(pending: PendingSend, server: Message): boolean {
  return (
    pending.channel === server.channel &&
    pending.hasMedia === !!server.media &&
    pending.hasLocation === !!server.location &&
    pending.text === server.text.trim()
  );
}

/**
 * Give every server message that this client just sent the render key of the
 * optimistic bubble it replaces, and drop the optimistic row once its server
 * copy has landed. Without this the row's key flips from `tmp_…` to the real
 * id, React unmounts and remounts the bubble, and the user sees it vanish and
 * fade back in instead of the tick quietly changing.
 */
function adoptClientKeys(
  list: Message[],
  pending: PendingSend[],
  keyMap: Map<string, string>,
): Message[] {
  const adopted = new Set<string>();
  const stitched = list.map((message) => {
    if (message.direction !== 'out' || message.id.startsWith(TMP_PREFIX)) return message;
    const known = keyMap.get(message.id);
    if (known) {
      adopted.add(known);
      return { ...message, clientKey: known };
    }
    const index = pending.findIndex((p) => isSameSend(p, message));
    if (index === -1) return message;
    const [match] = pending.splice(index, 1);
    if (!match) return message;
    keyMap.set(message.id, match.tmpId);
    adopted.add(match.tmpId);
    // Keep the local file uri: the server copy points at a remote/signed url
    // and swapping the source mid-flight makes the thumbnail blink.
    const media =
      message.media && match.localMediaUrl
        ? { ...message.media, url: match.localMediaUrl }
        : message.media;
    return { ...message, clientKey: match.tmpId, ...(media ? { media } : {}) };
  });
  if (adopted.size === 0) return stitched;
  return stitched.filter((m) => !adopted.has(m.id));
}

export interface ChannelCounts {
  all: number;
  whatsapp: number;
  email: number;
  messenger: number;
}

const FALLBACK_CONTACT: ChatContact = {
  id: '',
  name: 'Conversation',
  lastMessage: '',
  lastChannel: 'whatsapp',
  lastTime: '',
  unread: 0,
  windowExpiresAt: null,
};

/**
 * Real-data conversation state: loads the conversation + its messages, keeps
 * them live over socket.io, and exposes the same shape the UI already consumes
 * plus loading/error/send flags.
 */
/**
 * `unified` (default) keeps the WhatsApp + email thread with the channel filter
 * bar and email composer — used for lead-originated chats. Pass `unified: false`
 * (inbox-originated chats) to lock a non-Messenger conversation to WhatsApp only:
 * WhatsApp messages, WhatsApp composer, no email. Messenger threads are always
 * single-channel regardless of this flag.
 */
export function useConversation(
  conversationId: string,
  {
    unified = true,
    onTemplateRequired,
    canWhatsapp = true,
    canMessenger = true,
  }: Readonly<{
    unified?: boolean;
    onTemplateRequired?: () => void;
    /** User holds chat-whatsapp:read_write_conversations. Gates the WhatsApp channel. */
    canWhatsapp?: boolean;
    /** User holds chat-messenger:read_write_conversations. Gates the Messenger channel. */
    canMessenger?: boolean;
  }> = {},
) {
  const convQuery = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });

  const msgsQuery = useQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async () => toMessages(await getMessages(conversationId)),
    enabled: !!conversationId,
  });

  useChatSocket(conversationId);

  // Mark read once the conversation + messages have loaded.
  const hasUnread = (convQuery.data?.unreadCount ?? 0) > 0;
  useEffect(() => {
    if (!conversationId || !hasUnread) return;
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId, hasUnread]);

  const [activeFilter, setActiveFilter] = useState<ChannelFilter>('all');
  const [sendChannel, setSendChannel] = useState<Channel>('whatsapp');

  // Optimistic → server stitching state. Refs (not state) on purpose: adopting
  // a key must not itself trigger a render, and both maps are derived bookkeeping
  // rather than UI data.
  const pendingSendsRef = useRef<PendingSend[]>([]);
  const clientKeyByServerIdRef = useRef<Map<string, string>>(new Map());

  const trackPendingSend = useCallback((entry: Omit<PendingSend, 'sentAt'>) => {
    const now = Date.now();
    pendingSendsRef.current = pendingSendsRef.current.filter(
      (p) => now - p.sentAt < PENDING_MATCH_TTL_MS,
    );
    pendingSendsRef.current.push({ ...entry, sentAt: now });
  }, []);

  const allMessages: Message[] = useMemo(
    () =>
      adoptClientKeys(
        msgsQuery.data ?? [],
        pendingSendsRef.current,
        clientKeyByServerIdRef.current,
      ),
    [msgsQuery.data],
  );

  // Channel-level permission gate: a user only sees channels they can read/write.
  // WhatsApp / Messenger are permissioned; email rides the lead-email path and is
  // not chat-gated. Everything downstream (counts, filter pills, visible messages)
  // works off this permitted set so an unpermitted channel is hidden entirely.
  const permittedMessages = useMemo(
    () => allMessages.filter((m) => channelAllowed(m.channel, canWhatsapp, canMessenger)),
    [allMessages, canWhatsapp, canMessenger],
  );

  const availableFilters = useMemo<ChannelFilter[]>(
    () => CHANNEL_FILTERS.filter((f) => channelAllowed(f, canWhatsapp, canMessenger)),
    [canWhatsapp, canMessenger],
  );

  const counts = useMemo<ChannelCounts>(
    () => ({
      all: permittedMessages.length,
      whatsapp: permittedMessages.filter((m) => m.channel === 'whatsapp').length,
      email: permittedMessages.filter((m) => m.channel === 'email').length,
      messenger: permittedMessages.filter((m) => m.channel === 'messenger').length,
    }),
    [permittedMessages],
  );

  // Lock a non-Messenger inbox conversation to WhatsApp: only WhatsApp messages,
  // no email composer, no channel filter bar (see `unified` doc above).
  const isMessenger = isMessengerChannel(convQuery.data?.channel);
  const lockWhatsapp = !unified && !isMessenger;

  // WhatsApp 24h customer-service window. Skipped for Messenger threads (no such
  // window). `withinWindow` is the server-authoritative gate; `windowExpiresAt`
  // drives the header countdown badge. Outside the window (expired OR the lead
  // never replied) the thread is template-only — matches web.
  const windowQuery = useWhatsappWindow(isMessenger ? undefined : conversationId);
  const windowExpiresAt = windowQuery.data?.windowExpiresAt ?? null;
  const whatsappWindowOpen = windowQuery.data?.withinWindow ?? true;
  const whatsappNeedsTemplate = windowQuery.data?.withinWindow === false;

  // A template send does NOT reopen the window (only a customer reply does), so
  // the composer stays template-gated after sending. Distinguish "nothing sent
  // yet" from "template sent, awaiting reply" by the last WhatsApp message's
  // direction: an outbound tail while the window is closed means we already
  // reached out and are waiting on the lead.
  const lastWhatsappOutbound = useMemo(() => {
    for (let i = permittedMessages.length - 1; i >= 0; i -= 1) {
      const msg = permittedMessages[i];
      if (msg?.channel === 'whatsapp') return msg.direction === 'out';
    }
    return false;
  }, [permittedMessages]);
  const whatsappAwaitingReply = whatsappNeedsTemplate && lastWhatsappOutbound;

  const visibleMessages = useMemo(() => {
    if (lockWhatsapp) return permittedMessages.filter((m) => m.channel === 'whatsapp');
    // Fall back to 'all' if the active filter points at a channel the user just
    // lost / never had access to, so the list can't be stuck showing nothing.
    const filterOk = activeFilter === 'all' || availableFilters.includes(activeFilter);
    if (!filterOk || activeFilter === 'all') return permittedMessages;
    return permittedMessages.filter((m) => m.channel === activeFilter);
  }, [permittedMessages, activeFilter, lockWhatsapp, availableFilters]);

  const conv = convQuery.data;
  const contact = useMemo<ChatContact>(
    () => (conv ? toChatContact(conv) : { ...FALLBACK_CONTACT, id: conversationId }),
    [conv, conversationId],
  );

  const leadId = conv?.leadId ?? undefined;
  // Fall back to the lead record for the phone number: email-first conversations
  // are created with `customerPhone: null` (see backend `findOrCreateByEmail`),
  // but the lead itself usually has a phone — we still need it to start a
  // WhatsApp template thread from the conversation screen.
  const leadQuery = useLeadDetail(leadId);
  const phone = conv?.customerPhone ?? leadQuery.data?.phone ?? undefined;
  const emailEnabled = !lockWhatsapp && !!leadId;

  const qc = useQueryClient();
  const sendMutation = useSendMessage(conversationId);
  const messengerSend = useSendMessenger(conversationId);
  const send = useCallback(
    (payload: SendPayload) => {
      if (payload.channel === 'messenger') {
        const id = tmpId();
        const quote = payload.replyTo;
        const optimistic = buildOptimisticMessage({
          id,
          channel: 'messenger',
          text: payload.text,
          attachment: payload.attachment,
          replyTo: quote,
        });
        const key = chatKeys.messages(conversationId);
        qc.setQueryData<Message[]>(key, (prev) => [...(prev ?? []), optimistic]);
        trackPendingSend({
          tmpId: id,
          channel: 'messenger',
          text: payload.text.trim(),
          hasMedia: !!payload.attachment,
          hasLocation: false,
          localMediaUrl: payload.attachment?.uri,
        });
        const markFailed = (): void => {
          qc.setQueryData<Message[]>(key, markMessageFailed(id));
        };
        // Messenger has no reply-threading API — the quote is shown locally only
        // (optimistic bubble keeps replyTo); the wire payload sends plain text.
        const att = payload.attachment;
        if (att) {
          messengerSend.media.mutate(
            {
              conversationId,
              file: { uri: att.uri, name: att.name, type: att.mimeType },
            },
            { onError: markFailed },
          );
        } else {
          messengerSend.text.mutate(
            { conversationId, content: payload.text },
            { onError: markFailed },
          );
        }
        return;
      }
      if (payload.channel === 'email' && !leadId) return;

      const id = tmpId();
      const quote = payload.replyTo;
      const optimistic =
        payload.channel === 'email'
          ? buildOptimisticMessage({
              id,
              channel: 'email',
              text: payload.text,
              subject: payload.subject,
              replyTo: quote,
            })
          : buildOptimisticMessage({
              id,
              channel: 'whatsapp',
              text: payload.text,
              attachment: payload.channel === 'whatsapp' ? payload.attachment : undefined,
              location: payload.channel === 'whatsapp' ? payload.location : undefined,
              replyTo: quote,
            });

      const messagesKey = chatKeys.messages(conversationId);
      qc.setQueryData<Message[]>(messagesKey, (prev) => [...(prev ?? []), optimistic]);
      trackPendingSend({
        tmpId: id,
        channel: payload.channel,
        text: payload.text.trim(),
        hasMedia: !!optimistic.media,
        hasLocation: !!optimistic.location,
        localMediaUrl: optimistic.media?.url,
      });

      const markFailed = (err: unknown): void => {
        qc.setQueryData<Message[]>(messagesKey, markMessageFailed(id));
        // Backend rejects free-text when the WhatsApp 24h window is closed and no
        // template has opened it. Prompt the user to pick a template to reopen it.
        if (err instanceof ApiError && err.message === 'SELECT_TEMPLATE_FIRST') {
          onTemplateRequired?.();
          return;
        }
        // Otherwise surface why the send failed — a red bubble alone hides
        // backend/Meta errors (unsupported media, closed window, permissions).
        showErrorToast(err instanceof Error ? err.message : 'Message could not be sent.');
      };

      const mutationOptions = { onError: markFailed };
      const replyToId = quote?.id;
      if (payload.channel === 'email') {
        sendMutation.mutate(
          {
            channel: 'unified',
            leadId,
            subject: payload.subject,
            content: payload.text,
            ...(replyToId ? { replyToMessageId: replyToId } : {}),
          },
          mutationOptions,
        );
        return;
      }
      if (payload.channel === 'whatsapp' && payload.location) {
        const loc = payload.location;
        sendMutation.mutate(
          {
            channel: 'unified',
            to: phone,
            leadId,
            latitude: loc.latitude,
            longitude: loc.longitude,
            ...(loc.name ? { locationName: loc.name } : {}),
            ...(loc.address ? { locationAddress: loc.address } : {}),
            ...(replyToId ? { replyToMessageId: replyToId } : {}),
          },
          mutationOptions,
        );
        return;
      }
      const att = payload.attachment;
      if (att) {
        sendMutation.mutate(
          {
            channel: 'unified',
            to: phone,
            leadId,
            caption: payload.text.trim() || undefined,
            type: att.kind,
            filename: att.name,
            file: { uri: att.uri, name: att.name, type: att.mimeType },
            ...(replyToId ? { replyToMessageId: replyToId } : {}),
          },
          mutationOptions,
        );
        return;
      }
      sendMutation.mutate(
        {
          channel: 'unified',
          to: phone,
          leadId,
          content: payload.text,
          ...(replyToId ? { replyToMessageId: replyToId } : {}),
        },
        mutationOptions,
      );
    },
    [
      conversationId,
      phone,
      leadId,
      qc,
      sendMutation,
      messengerSend,
      onTemplateRequired,
      trackPendingSend,
    ],
  );

  // Re-send a failed bubble. Drops the failed message from cache and (if it
  // was persisted server-side) hard-deletes the DB row so a refetch can't
  // resurrect it. Then replays the payload through `send`, which generates
  // a fresh `tmp_…` id, a current timestamp, and a new pending → sent ladder.
  const retry = useCallback(
    (failedId: string) => {
      const messagesKey = chatKeys.messages(conversationId);
      const list = qc.getQueryData<Message[]>(messagesKey) ?? [];
      const failed = list.find((m) => m.id === failedId);
      if (failed?.status !== 'failed') return;
      qc.setQueryData<Message[]>(messagesKey, (prev) =>
        (prev ?? []).filter((m) => m.id !== failedId),
      );
      // The abandoned bubble must not stitch onto a later server message.
      pendingSendsRef.current = pendingSendsRef.current.filter(
        (p) => p.tmpId !== (failed.clientKey ?? failedId),
      );
      const isPersisted = !failedId.startsWith(TMP_PREFIX);
      if (isPersisted) {
        deleteMessage(failedId).catch(() => {
          /* swallow — invalidate after send will resync */
        });
      }
      if (failed.channel === 'email') {
        send({ channel: 'email', subject: failed.subject ?? '', text: failed.text });
        return;
      }
      const media = failed.media;
      // Only re-upload when we still hold the LOCAL file uri (optimistic bubble).
      // A persisted-failed message carries a remote CDN url that RN FormData
      // cannot stream as a multipart part — retrying that would silently send a
      // broken upload, so we fall back to a text-only retry in that case.
      const isLocalUri = (u: string | undefined): boolean => !!u && /^(file:|content:|\/)/i.test(u);
      const attachment =
        media && isLocalUri(media.url)
          ? {
              uri: media.url ?? '',
              name: media.name ?? 'attachment',
              mimeType: media.mimeType ?? 'application/octet-stream',
              kind: media.kind,
            }
          : undefined;
      if (failed.channel === 'messenger') {
        send({ channel: 'messenger', text: failed.text, attachment });
        return;
      }
      send({ channel: 'whatsapp', text: failed.text, attachment });
    },
    [conversationId, qc, send],
  );

  return {
    contact,
    subtitle: lockWhatsapp ? 'WhatsApp' : 'All messages in one thread',
    messages: visibleMessages,
    activeFilter,
    setActiveFilter,
    availableFilters,
    sendChannel,
    setSendChannel,
    counts,
    send,
    retry,
    isLoading: convQuery.isLoading || msgsQuery.isLoading,
    isError: convQuery.isError || msgsQuery.isError,
    refetch: () => {
      convQuery.refetch().catch(() => {});
      msgsQuery.refetch().catch(() => {});
    },
    emailEnabled,
    leadId,
    phone,
    isSending:
      sendMutation.isPending || messengerSend.text.isPending || messengerSend.media.isPending,
    isMessenger,
    lockWhatsapp,
    windowExpiresAt,
    whatsappWindowOpen,
    whatsappNeedsTemplate,
    whatsappAwaitingReply,
  };
}
