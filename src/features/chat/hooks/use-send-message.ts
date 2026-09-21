import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendMessage } from '../api/services';
import type { SendMessageInput } from '../api/types';
import { chatKeys } from './keys';

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, SendMessageInput>({
    mutationFn: sendMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
      qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
    },
  });
}
