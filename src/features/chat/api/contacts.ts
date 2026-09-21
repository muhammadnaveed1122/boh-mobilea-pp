/**
 * Agent phonebook + broadcast API.
 *
 * Every route here is gated on `chat-whatsapp:read_write_conversations` AND
 * on the caller owning an active dedicated WhatsApp number — shared-number
 * agents get a 403 from `requireDedicatedNumbers()`. Callers surface that as
 * "feature unavailable" rather than an error (see `isDedicatedNumberDenied`).
 *
 * The axios response interceptor already unwraps the `{ success, data }`
 * envelope, so handlers receive the payload directly; `extractRows` stays as a
 * defensive normalizer for list shapes.
 */

import { isAxiosError } from 'axios';

import { apiClient } from '@/lib/api';

import type {
  AgentContact,
  BroadcastResult,
  ChannelBroadcast,
  ContactGroup,
  CreateContactInput,
  ImportContactsInput,
  BroadcastTemplateInput,
  SendMultiTemplateInput,
} from '../models/contact';
import { extractRows } from './types';

const BASE = '/api/v1/chat/whatsapp/contacts';

/**
 * True when the failure is the backend's dedicated-number gate rather than a
 * real error. Used to hide the phonebook for shared-number agents.
 */
export function isDedicatedNumberDenied(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403;
}

export async function getAgentContacts(): Promise<AgentContact[]> {
  const { data } = await apiClient.get<unknown>(BASE);
  return extractRows<AgentContact>(data);
}

export async function createAgentContact(input: CreateContactInput): Promise<AgentContact> {
  const { data } = await apiClient.post<AgentContact>(BASE, input);
  return data;
}

export async function deleteAgentContact(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

/** Bulk import. Backend caps the batch at 1000 rows. */
export async function importAgentContacts(
  input: ImportContactsInput,
): Promise<{ imported: number }> {
  const { data } = await apiClient.post<{ imported: number }>(`${BASE}/import`, input);
  return data;
}

/** Backend returns groups with a nested `_count.contacts`; flatten it here. */
export async function getContactGroups(): Promise<ContactGroup[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/groups`);
  const rows = extractRows<ContactGroup & { _count?: { contacts?: number } }>(data);
  return rows.map(({ _count, ...group }) => ({
    ...group,
    contactCount: group.contactCount ?? _count?.contacts ?? 0,
  }));
}

export async function createContactGroup(name: string): Promise<ContactGroup> {
  const { data } = await apiClient.post<ContactGroup>(`${BASE}/groups`, { name });
  return { ...data, contactCount: data.contactCount ?? 0 };
}

export async function deleteContactGroup(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/groups/${id}`);
}

export async function getChannelBroadcasts(groupId: string): Promise<ChannelBroadcast[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/groups/${groupId}/broadcasts`);
  return extractRows<ChannelBroadcast>(data);
}

/**
 * Blast a template to every member of a group. The backend sends one 1-1
 * message per member from the agent's own number — this is not a WhatsApp
 * group message.
 */
export async function sendGroupTemplate(
  groupId: string,
  input: BroadcastTemplateInput,
): Promise<BroadcastResult> {
  const { data } = await apiClient.post<BroadcastResult>(
    `${BASE}/groups/${groupId}/send-template`,
    input,
  );
  return data;
}

/** Ad-hoc blast to hand-picked contacts, no group involved. Backend caps at 200. */
export async function sendMultiTemplate(input: SendMultiTemplateInput): Promise<BroadcastResult> {
  const { data } = await apiClient.post<BroadcastResult>(`${BASE}/send-template`, input);
  return data;
}
