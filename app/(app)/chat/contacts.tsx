import { Redirect } from 'expo-router';

import { ContactsScreen } from '@/features/chat/components/contacts/ContactsScreen';
import { CHAT_WHATSAPP_CONTACTS, useRequirePermission } from '@/lib/rbac';

export default function ContactsRoute() {
  const state = useRequirePermission(CHAT_WHATSAPP_CONTACTS);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return <ContactsScreen />;
}
