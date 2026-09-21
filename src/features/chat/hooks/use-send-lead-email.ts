import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendLeadEmail } from '../api/services';
import type { SendLeadEmailInput } from '../api/types';
import { chatKeys } from './keys';

/**
 * Sends an email to a lead, then invalidates the chat caches so the gate
 * re-resolves the (now-created) conversation and mounts ConversationScreen.
 */
export function useSendLeadEmail() {
  const qc = useQueryClient();
  return useMutation<void, Error, SendLeadEmailInput>({
    mutationFn: sendLeadEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all }).catch(() => {});
    },
  });
}
