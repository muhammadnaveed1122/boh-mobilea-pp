import { useMutation, useQueryClient } from '@tanstack/react-query';

import { startWhatsappChat } from '../api/services';
import type { StartWhatsappChatInput } from '../api/types';
import { chatKeys } from './keys';

/**
 * Start a WhatsApp chat with a raw phone number.
 *
 * Retries are off: the expected failure here is `SELECT_TEMPLATE_FIRST`, a
 * deliberate backend rejection that the caller answers by picking a template.
 * Retrying it would just send the same rejected payload again.
 */
export function useStartChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartWhatsappChatInput) => startWhatsappChat(input),
    retry: false,
    onSuccess: () => {
      // A brand-new number adds a row to the inbox; an existing one reorders it.
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}
