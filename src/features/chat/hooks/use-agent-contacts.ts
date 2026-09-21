import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CHAT_WHATSAPP_CONTACTS, useCan } from '@/lib/rbac';

import {
  createAgentContact,
  deleteAgentContact,
  getAgentContacts,
  importAgentContacts,
  isDedicatedNumberDenied,
} from '../api/contacts';
import { useHasDedicatedNumber } from './use-my-whatsapp-numbers';
import type { CreateContactInput, ImportContactsInput } from '../models/contact';
import { chatKeys } from './keys';

/**
 * The agent's saved phonebook.
 *
 * Retries are disabled for the dedicated-number 403 — that response is a
 * permanent capability gate, not a transient failure, so re-requesting it
 * three times on every mount just burns requests.
 */
export function useAgentContacts() {
  const canWrite = useCan(CHAT_WHATSAPP_CONTACTS);
  return useQuery({
    queryKey: chatKeys.agentContacts(),
    queryFn: getAgentContacts,
    enabled: canWrite,
    staleTime: 60_000,
    retry: (failureCount, error) => !isDedicatedNumberDenied(error) && failureCount < 2,
  });
}

/**
 * Whether the phonebook/broadcast surface should be shown at all.
 *
 * Reads the agent's DID list rather than inferring from a 403 on the contacts
 * call. Same underlying backend query (`listActiveForUser`), but asked directly
 * — so the answer does not depend on having already fired a request that fails.
 */
export function useContactsAvailable(): boolean {
  const canWrite = useCan(CHAT_WHATSAPP_CONTACTS);
  const hasNumber = useHasDedicatedNumber();
  return canWrite && hasNumber;
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) => createAgentContact(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.agentContacts() });
      // Membership counts on the group chips move with every add.
      qc.invalidateQueries({ queryKey: chatKeys.contactGroups() });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAgentContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.agentContacts() });
      qc.invalidateQueries({ queryKey: chatKeys.contactGroups() });
    },
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportContactsInput) => importAgentContacts(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.agentContacts() });
      qc.invalidateQueries({ queryKey: chatKeys.contactGroups() });
    },
  });
}
