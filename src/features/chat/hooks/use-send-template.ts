import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendWhatsappTemplate } from '../api/services';
import type { SendTemplateInput } from '../api/types';
import { chatKeys } from './keys';

/** Sends a WhatsApp template, then re-resolves the lead's conversation. */
export function useSendTemplate(leadId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, SendTemplateInput>({
    mutationFn: sendWhatsappTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all }).catch(() => {});
    },
  });
}
