import { useCallback } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor, useThemeColorAlpha } from '@theme';

import type { MessageContact } from '../models/message';

/** Strip formatting so `tel:` gets a dialable string. */
function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function PhoneRow({ phone, accent }: Readonly<{ phone: string; accent: string }>) {
  const call = useCallback(() => {
    Linking.openURL(`tel:${dialable(phone)}`).catch(() => {});
  }, [phone]);

  return (
    <Pressable
      onPress={call}
      accessibilityRole="button"
      accessibilityLabel={`Call ${phone}`}
      hitSlop={4}
      className="mt-0.5 flex-row items-center active:opacity-70"
    >
      <Icon name="Phone" size={12} color={accent} />
      <Text className="ml-1.5 text-xs text-muted-foreground" numberOfLines={1}>
        {phone}
      </Text>
    </Pressable>
  );
}

function ContactCard({ contact }: Readonly<{ contact: MessageContact }>) {
  const accent = useThemeColor('--info');
  const accentTint = useThemeColorAlpha('--info', 0.13);
  const initial = contact.name.trim().charAt(0).toUpperCase() || '#';

  return (
    <View className="w-[220px] flex-row items-center rounded-xl border border-border bg-background/40 p-2.5">
      <View
        className="mr-2.5 h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: accentTint }}
      >
        {contact.phones.length > 0 ? (
          <Text className="text-sm font-semibold" style={{ color: accent }}>
            {initial}
          </Text>
        ) : (
          <Icon name="User" size={20} color={accent} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {contact.name}
        </Text>
        {contact.phones.length > 0 ? (
          contact.phones.map((phone) => <PhoneRow key={phone} phone={phone} accent={accent} />)
        ) : (
          <Text className="text-xs text-muted-foreground">No phone number</Text>
        )}
      </View>
    </View>
  );
}

/** Renders the shared-contact cards of a WhatsApp `contacts` message. */
export function ContactMessage({ contacts }: Readonly<{ contacts: MessageContact[] }>) {
  return (
    <View className="gap-1.5">
      {contacts.map((contact, i) => (
        <ContactCard key={`${contact.name}-${contact.phones[0] ?? i}`} contact={contact} />
      ))}
    </View>
  );
}
