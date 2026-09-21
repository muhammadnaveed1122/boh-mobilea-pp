import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CHAT_WHATSAPP_CONTACTS, useCan } from '@/lib/rbac';

import {
  createContactGroup,
  deleteContactGroup,
  getContactGroups,
  isDedicatedNumberDenied,
} from '../api/contacts';
import { chatKeys } from './keys';

/** Broadcast groups ("channels") owned by the agent. */
export function useContactGroups() {
  const canWrite = useCan(CHAT_WHATSAPP_CONTACTS);
  return useQuery({
    queryKey: chatKeys.contactGroups(),
    queryFn: getContactGroups,
    enabled: canWrite,
    staleTime: 60_000,
    retry: (failureCount, error) => !isDedicatedNumberDenied(error) && failureCount < 2,
  });
}

export function useCreateContactGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createContactGroup(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.contactGroups() });
    },
  });
}

export function useDeleteContactGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContactGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.contactGroups() });
      // Deleting a group unlinks its members, so their `group` field is stale.
      qc.invalidateQueries({ queryKey: chatKeys.agentContacts() });
    },
  });
}
