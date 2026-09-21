import { useQuery } from '@tanstack/react-query';

import { getWhatsappWindowStatus, getWhatsappWindowStatusByPhone } from '../api/services';
import { chatKeys } from './keys';

/**
 * Tracks whether the WhatsApp 24h customer-service window is open for a
 * conversation. Outside the window, only approved templates can be sent —
 * the composer is locked and a hint banner shown until the lead replies.
 */
export function useWhatsappWindow(conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.whatsappWindow(conversationId ?? ''),
    queryFn: () => getWhatsappWindowStatus(conversationId as string),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

/**
 * Same check for a raw phone number, before a conversation exists — used by the
 * new-chat composer to decide upfront whether free text is allowed or a
 * template is required. Pass `''` (the caller's "number isn't complete yet"
 * signal) to keep the query idle.
 */
export function useWhatsappWindowByPhone(phone: string) {
  return useQuery({
    queryKey: chatKeys.whatsappWindowByPhone(phone),
    queryFn: () => getWhatsappWindowStatusByPhone(phone),
    enabled: phone !== '',
    staleTime: 30_000,
  });
}
