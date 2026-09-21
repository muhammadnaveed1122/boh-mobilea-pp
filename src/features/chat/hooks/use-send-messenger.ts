import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendMessengerMedia, sendMessengerMessage } from '../api/services';
import type { SendMessengerInput, SendMessengerMediaInput } from '../api/types';
import { chatKeys } from './keys';

/**
 * Messenger send mutations. Messenger uses its own backend endpoints
 * (conversationId-keyed) rather than the unified `/chat/send`. Both mutations
 * invalidate the conversation's message list and the inbox on success.
 */
export function useSendMessenger(conversationId: string) {
  const qc = useQueryClient();

  const invalidate = (): void => {
    qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
    qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
  };

  const text = useMutation<void, Error, SendMessengerInput>({
    mutationFn: sendMessengerMessage,
    onSuccess: invalidate,
  });

  const media = useMutation<void, Error, SendMessengerMediaInput>({
    mutationFn: sendMessengerMedia,
    onSuccess: invalidate,
  });

  return { text, media };
}
