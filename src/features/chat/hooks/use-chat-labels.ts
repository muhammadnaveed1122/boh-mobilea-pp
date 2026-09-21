import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getChatLabels,
  getConversationLabels,
  saveChatLabels,
  setConversationLabels,
} from '../api/labels';
import type { SaveLabelItem } from '../models/label';
import { chatKeys } from './keys';

export function useChatLabels() {
  return useQuery({
    queryKey: chatKeys.chatLabels(),
    queryFn: getChatLabels,
    staleTime: 60_000,
  });
}

export function useSaveChatLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labels: SaveLabelItem[]) => saveChatLabels(labels),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.chatLabels() });
      // A rename/recolor/delete changes chips on any conversation.
      qc.invalidateQueries({ queryKey: [...chatKeys.all, 'conversation-labels'] });
    },
  });
}

export function useConversationLabels(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.conversationLabels(conversationId),
    queryFn: () => getConversationLabels(conversationId),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

export function useSetConversationLabels(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labelIds: string[]) => setConversationLabels(conversationId, labelIds),
    onSuccess: (labels) => {
      qc.setQueryData(chatKeys.conversationLabels(conversationId), labels);
    },
  });
}
