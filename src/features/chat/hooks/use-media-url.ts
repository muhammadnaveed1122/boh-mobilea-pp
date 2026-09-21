import { useQuery } from '@tanstack/react-query';

import { getMediaUrl } from '../api/services';
import { chatKeys } from './keys';

/** Lazily resolve a signed media URL for a message (only when needed). */
export function useMediaUrl(messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.mediaUrl(messageId),
    queryFn: () => getMediaUrl(messageId),
    enabled: enabled && !!messageId,
    staleTime: 5 * 60_000,
  });
}
