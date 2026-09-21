import { apiClient } from '@/lib/api';

import type { ChatLabel, SaveLabelItem } from '../models/label';

interface Wrapped<T> {
  data?: T;
}

/** Backend wraps most responses as `{ data }`; unwrap defensively. */
function unwrap<T>(payload: Wrapped<T> | T): T {
  return payload && typeof payload === 'object' && 'data' in (payload as Wrapped<T>)
    ? ((payload as Wrapped<T>).data as T)
    : (payload as T);
}

export async function getChatLabels(): Promise<ChatLabel[]> {
  const { data } = await apiClient.get<Wrapped<ChatLabel[]> | ChatLabel[]>('/api/v1/chat-labels');
  return unwrap(data) ?? [];
}

export async function saveChatLabels(labels: SaveLabelItem[]): Promise<ChatLabel[]> {
  const { data } = await apiClient.put<Wrapped<ChatLabel[]> | ChatLabel[]>('/api/v1/chat-labels', {
    labels,
  });
  return unwrap(data) ?? [];
}

export async function getConversationLabels(conversationId: string): Promise<ChatLabel[]> {
  const { data } = await apiClient.get<Wrapped<ChatLabel[]> | ChatLabel[]>(
    `/api/v1/chat-labels/conversations/${conversationId}`,
  );
  return unwrap(data) ?? [];
}

export async function setConversationLabels(
  conversationId: string,
  labelIds: string[],
): Promise<ChatLabel[]> {
  const { data } = await apiClient.put<Wrapped<ChatLabel[]> | ChatLabel[]>(
    `/api/v1/chat-labels/conversations/${conversationId}`,
    { labelIds },
  );
  return unwrap(data) ?? [];
}

/** Assign a Messenger/WhatsApp conversation to a lead (channel-specific route). */
export async function assignConversationToLead(
  channel: string,
  conversationId: string,
  leadId: string,
): Promise<void> {
  const seg = channel === 'messenger' ? 'messenger' : 'whatsapp';
  await apiClient.patch(`/api/v1/chat/${seg}/conversations/${conversationId}/assign-lead`, {
    leadId,
  });
}
