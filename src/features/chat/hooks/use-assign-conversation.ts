import { useMutation, useQueryClient } from '@tanstack/react-query';

import { assignConversationToLead } from '../api/labels';
import { chatKeys } from './keys';

export function useAssignConversationToLead(conversationId: string, channel: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => assignConversationToLead(channel, conversationId, leadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}
