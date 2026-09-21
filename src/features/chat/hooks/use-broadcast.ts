import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getChannelBroadcasts, sendGroupTemplate, sendMultiTemplate } from '../api/contacts';
import type { BroadcastTemplateInput, SendMultiTemplateInput } from '../models/contact';
import { chatKeys } from './keys';

/** Broadcast history feed for one channel. */
export function useChannelBroadcasts(groupId: string) {
  return useQuery({
    queryKey: chatKeys.channelBroadcasts(groupId),
    queryFn: () => getChannelBroadcasts(groupId),
    enabled: groupId !== '',
    staleTime: 30_000,
  });
}

export function useSendGroupTemplate(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BroadcastTemplateInput) => sendGroupTemplate(groupId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.channelBroadcasts(groupId) });
      // Every member gets a real 1-1 message, so the inbox reorders.
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useSendMultiTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMultiTemplateInput) => sendMultiTemplate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}
