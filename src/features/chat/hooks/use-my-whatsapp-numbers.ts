import { useQuery } from '@tanstack/react-query';

import { CHAT_WHATSAPP_CONTACTS, useCan } from '@/lib/rbac';

import { getMyWhatsappNumbers } from '../api/services';
import { chatKeys } from './keys';

/**
 * The agent's own active WhatsApp numbers (DIDs).
 *
 * Long `staleTime`: DID assignment is an admin action that happens once, not
 * something that changes while the user is in the app.
 */
export function useMyWhatsappNumbers() {
  const canChat = useCan(CHAT_WHATSAPP_CONTACTS);
  return useQuery({
    queryKey: chatKeys.myWhatsappNumbers(),
    queryFn: getMyWhatsappNumbers,
    enabled: canChat,
    staleTime: 5 * 60_000,
  });
}

/**
 * Whether the agent has a dedicated WhatsApp number, which is what unlocks the
 * phonebook, broadcast channels and multi-contact sends.
 *
 * This mirrors web's `myNumbers.length > 0` and, more importantly, mirrors the
 * backend: `agent-contacts` 403s any caller whose `listActiveForUser` comes
 * back empty, and this reads that same list. Gating on it means the UI offers
 * exactly the actions the API will accept.
 *
 * Defaults to `false` while loading, so the broadcast options never flash in
 * for an agent who turns out not to have a number.
 */
export function useHasDedicatedNumber(): boolean {
  const { data } = useMyWhatsappNumbers();
  return (data?.length ?? 0) > 0;
}
