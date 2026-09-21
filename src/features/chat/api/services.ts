import { isAxiosError } from 'axios';

import { apiClient } from '@/lib/api';

import {
  type ApiConversation,
  type ApiMessage,
  type ApiWhatsappTemplate,
  extractRows,
  type MyWhatsappNumber,
  type SendLeadEmailInput,
  type SendMessageInput,
  type SendMessengerInput,
  type SendMessengerMediaInput,
  type SendTemplateInput,
  type StartWhatsappChatInput,
  type StartWhatsappChatResult,
} from './types';

const BASE = '/api/v1/chat';

export async function getConversations(): Promise<ApiConversation[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/conversations`);
  return extractRows<ApiConversation>(data);
}

export async function getConversation(id: string): Promise<ApiConversation> {
  const { data } = await apiClient.get<ApiConversation>(`${BASE}/conversations/${id}`);
  return data;
}

/**
 * Backend serves messages as threaded roots — each row may carry a nested
 * `replies: ApiMessage[]` array for reply children. The mobile chat is
 * flat, so we walk the tree and hoist every reply to the top level. The
 * resolved `replyTo` strip is then rebuilt in `toMessages` from each row's
 * `metadata.replyToMessageId`.
 */
function flattenThreads(rows: (ApiMessage & { replies?: ApiMessage[] })[]): ApiMessage[] {
  const out: ApiMessage[] = [];
  for (const row of rows) {
    const { replies, ...msg } = row;
    out.push(msg);
    if (replies && replies.length > 0) {
      out.push(...flattenThreads(replies));
    }
  }
  return out;
}

export async function getMessages(conversationId: string): Promise<ApiMessage[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/conversations/${conversationId}/messages`);
  const rows = extractRows<ApiMessage & { replies?: ApiMessage[] }>(data);
  return flattenThreads(rows);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiClient.delete(`${BASE}/messages/${messageId}`);
}

export async function sendMessage(input: SendMessageInput): Promise<void> {
  if (input.file) {
    const form = new FormData();
    form.append('channel', input.channel);
    if (input.to) form.append('to', input.to);
    if (input.leadId) form.append('leadId', input.leadId);
    if (input.content) form.append('content', input.content);
    if (input.caption) form.append('caption', input.caption);
    if (input.type) form.append('type', input.type);
    if (input.filename) form.append('filename', input.filename);
    if (input.replyToMessageId) form.append('replyToMessageId', input.replyToMessageId);
    form.append('file', {
      uri: input.file.uri,
      name: input.file.name,
      type: input.file.type,
    } as unknown as Blob);
    await apiClient.post(`${BASE}/send`, form, {
      headers: { 'Content-Type': undefined },
    });
    return;
  }
  await apiClient.post(`${BASE}/send`, input);
}

interface MediaUrlResponse {
  mediaUrl?: string | null;
  url?: string | null;
  data?: { url?: string | null; mediaUrl?: string | null } | null;
}

export async function getMediaUrl(messageId: string): Promise<string> {
  const { data } = await apiClient.get<MediaUrlResponse>(`${BASE}/messages/${messageId}/media-url`);
  return data.mediaUrl ?? data.url ?? data.data?.url ?? data.data?.mediaUrl ?? '';
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.patch(`${BASE}/conversations/${conversationId}/read`);
}

/**
 * Resolve a lead's conversation. Pass no `channel` to get the lead's single
 * unified conversation (carries WhatsApp + email history); pass a channel to
 * filter to that channel only.
 */
export async function getConversationByLead(
  leadId: string,
  channel?: string,
): Promise<ApiConversation | null> {
  try {
    const { data } = await apiClient.get<ApiConversation>(
      `${BASE}/conversations/by-lead/${leadId}`,
      { params: channel ? { channel } : {} },
    );
    return data ?? null;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * The current agent's own active WhatsApp numbers (DIDs). Empty means a
 * shared-number agent.
 *
 * This is the authoritative dedicated-number signal: the backend resolves it
 * with the same `listActiveForUser` query that `agent-contacts` uses to 403
 * shared-number agents, so gating the UI on this cannot disagree with what the
 * contacts and broadcast endpoints will actually allow.
 */
export async function getMyWhatsappNumbers(): Promise<MyWhatsappNumber[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/whatsapp/my-numbers`);
  return extractRows<MyWhatsappNumber>(data);
}

export async function getWhatsappTemplates(): Promise<ApiWhatsappTemplate[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/whatsapp/templates`);
  return extractRows<ApiWhatsappTemplate>(data);
}

/**
 * Send a WhatsApp template to bootstrap a lead conversation. Goes through the
 * unified `/chat/send` (gated on `chat-whatsapp:read_write_conversations`) — NOT
 * the dedicated `/chat/whatsapp/messages/template` route, which the backend gates
 * on `chat-whatsapp:manage_templates` (superadmin-only) and so 403s for agents. The web
 * client sends templates the same way. The unified DTO expects `templateName` +
 * `templateLanguage`, so `languageCode` is mapped across here.
 */
export async function sendWhatsappTemplate(input: SendTemplateInput): Promise<void> {
  const { to, leadId, templateName, languageCode } = input;
  await apiClient.post(`${BASE}/send`, {
    channel: 'whatsapp',
    to,
    leadId,
    templateName,
    templateLanguage: languageCode,
  });
}

/**
 * Start (or continue) a WhatsApp chat with a raw phone number.
 *
 * Uses `/chat/whatsapp/messages`, which is gated on
 * `chat-whatsapp:read_write_conversations` — the same code the rest of the
 * chat uses — and resolves the conversation from the number itself. The
 * unified `/chat/send` cannot do this: it needs an existing conversation or a
 * `leadId`, so it is useless for a number the CRM has never seen.
 *
 * The backend's `findOrCreate` returns the existing thread when there already
 * is one, so this never produces a duplicate conversation.
 */
export async function startWhatsappChat(
  input: StartWhatsappChatInput,
): Promise<StartWhatsappChatResult> {
  const { data } = await apiClient.post<{ conversationId: string }>(
    `${BASE}/whatsapp/messages`,
    input,
  );
  return { conversationId: data.conversationId };
}

/**
 * Set or remove the caller's reaction on a chat message. Empty `emoji` means
 * remove; same emoji as current also removes; a different emoji replaces.
 */
export async function setMessageReaction(messageId: string, emoji: string): Promise<void> {
  await apiClient.put(`${BASE}/messages/${messageId}/reactions`, { emoji });
}

/**
 * Returns whether the 24h WhatsApp messaging window is open for this
 * conversation. Window opens for 24h after the lead's last inbound message;
 * outside it, only approved templates can be sent. `windowExpiresAt` is the
 * absolute ISO expiry (last inbound + 24h) that drives the client countdown,
 * or `null` when no inbound message exists yet.
 */
export async function getWhatsappWindowStatus(
  conversationId: string,
): Promise<{ withinWindow: boolean; windowExpiresAt: string | null }> {
  const { data } = await apiClient.get<{ withinWindow: boolean; windowExpiresAt: string | null }>(
    `${BASE}/whatsapp/conversations/${conversationId}/window-status`,
  );
  return data;
}

/**
 * Same 24h-window check, but keyed on a raw phone number instead of a
 * conversation id — the new-chat composer needs the answer *before* any
 * conversation exists, so it can offer free text or a template upfront rather
 * than after a rejected send. A number the CRM has never seen comes back
 * `{ withinWindow: false, windowExpiresAt: null }`, i.e. template-only.
 */
export async function getWhatsappWindowStatusByPhone(
  phone: string,
): Promise<{ withinWindow: boolean; windowExpiresAt: string | null }> {
  const { data } = await apiClient.get<{ withinWindow: boolean; windowExpiresAt: string | null }>(
    `${BASE}/whatsapp/window-status`,
    { params: { phone } },
  );
  return data;
}

/**
 * Send an email to a lead. No conversation needed — the backend resolves /
 * creates the lead's unified conversation from `leadId`.
 */
export async function sendLeadEmail(input: SendLeadEmailInput): Promise<void> {
  await apiClient.post(`${BASE}/send`, input);
}

/**
 * Send a Messenger text reply. Uses the dedicated messenger endpoint (NOT
 * `/chat/send`, which rejects `channel=messenger`). PSID is resolved
 * server-side from the conversation.
 */
export async function sendMessengerMessage(input: SendMessengerInput): Promise<void> {
  await apiClient.post(`${BASE}/messenger/messages`, input);
}

/**
 * Send a Messenger media file or voice note (multipart). The backend uploads
 * the buffer to storage and forwards it to Meta. Audio is sent natively when
 * the mime is Meta-accepted (audio/mp4 from `.m4a` recordings qualifies).
 */
export async function sendMessengerMedia(input: SendMessengerMediaInput): Promise<void> {
  const form = new FormData();
  form.append('conversationId', input.conversationId);
  form.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.type,
  } as unknown as Blob);
  await apiClient.post(`${BASE}/messenger/messages/media`, form, {
    headers: { 'Content-Type': undefined },
  });
}
