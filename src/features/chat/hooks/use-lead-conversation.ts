import { useQuery } from '@tanstack/react-query';

import { getConversationByLead } from '../api/services';
import { chatKeys } from './keys';

/**
 * Resolves the lead's single unified conversation (carries WhatsApp + email),
 * or null if the lead has no conversation yet.
 */
export function useLeadConversation(leadId: string) {
  return useQuery({
    queryKey: chatKeys.conversationByLead(leadId),
    queryFn: () => getConversationByLead(leadId),
    enabled: !!leadId,
  });
}
