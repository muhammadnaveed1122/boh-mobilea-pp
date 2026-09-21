export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  conversationByLead: (leadId: string) =>
    [...chatKeys.all, 'conversation-by-lead', leadId] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
  mediaUrl: (id: string) => [...chatKeys.all, 'media-url', id] as const,
  whatsappTemplates: () => [...chatKeys.all, 'whatsapp-templates'] as const,
  whatsappWindow: (conversationId: string) =>
    [...chatKeys.all, 'whatsapp-window', conversationId] as const,
  whatsappWindowByPhone: (phone: string) =>
    [...chatKeys.all, 'whatsapp-window-phone', phone] as const,
  chatLabels: () => [...chatKeys.all, 'labels'] as const,
  conversationLabels: (conversationId: string) =>
    [...chatKeys.all, 'conversation-labels', conversationId] as const,
  myWhatsappNumbers: () => [...chatKeys.all, 'my-whatsapp-numbers'] as const,
  agentContacts: () => [...chatKeys.all, 'agent-contacts'] as const,
  contactGroups: () => [...chatKeys.all, 'contact-groups'] as const,
  channelBroadcasts: (groupId: string) => [...chatKeys.all, 'channel-broadcasts', groupId] as const,
  listingSearch: (search: string) => [...chatKeys.all, 'listing-search', search] as const,
};
