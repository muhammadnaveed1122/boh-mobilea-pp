import { Pressable, View } from 'react-native';

import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useContactNames } from '../hooks/use-contact-names';
import { CHANNEL_META } from '../models/channel';
import type { ChatContact } from '../models/conversation';
import { ChannelIcon } from './ChannelIcon';
import { ContactAvatar } from './contacts/ContactAvatar';
import { InboxWindowPill } from './InboxWindowPill';

interface Props {
  contact: ChatContact;
  onPress: (id: string) => void;
}

export function ContactRow({ contact, onPress }: Readonly<Props>) {
  const meta = CHANNEL_META[contact.lastChannel];
  const channelColor = useThemeColor(meta.accentToken);
  const hasUnread = contact.unread > 0;
  // A saved phonebook name wins over the WhatsApp profile name / raw number.
  const { resolve } = useContactNames();
  const displayName = resolve(contact.phone, contact.name);
  // Only WhatsApp threads have a 24h reply window; email/Messenger have none.
  const showWindow = contact.lastChannel === 'whatsapp';

  return (
    <Pressable
      onPress={() => onPress(contact.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${displayName}`}
      className="flex-row items-center px-4 py-3 active:bg-muted"
    >
      <View className="relative">
        <ContactAvatar name={displayName} seed={contact.phone ?? contact.id} size={48} />
        <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-card">
          <ChannelIcon channel={contact.lastChannel} size={12} color={channelColor} />
        </View>
      </View>

      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className={hasUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground'}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            className={
              hasUnread ? 'ml-2 text-xs text-primary' : 'ml-2 text-xs text-muted-foreground'
            }
          >
            {contact.lastTime}
          </Text>
        </View>

        <View className="mt-0.5 flex-row items-center">
          <Text
            className={
              hasUnread ? 'flex-1 text-sm text-foreground' : 'flex-1 text-sm text-muted-foreground'
            }
            numberOfLines={1}
          >
            {contact.lastMessage}
          </Text>
          {showWindow ? (
            <View className="ml-2">
              <InboxWindowPill windowExpiresAt={contact.windowExpiresAt} />
            </View>
          ) : null}
          {hasUnread ? (
            // `py-0` cancels the Badge's default vertical padding so the fixed
            // 20px height centers the digits; `includeFontPadding: false` drops
            // Android's extra glyph padding, which otherwise pushes them low.
            <Badge
              variant="default"
              className="ml-2 h-5 min-w-5 items-center justify-center px-1.5 py-0"
            >
              <Text
                className="text-[11px] font-bold text-primary-foreground"
                style={{ lineHeight: 13, includeFontPadding: false, textAlign: 'center' }}
              >
                {contact.unread > 99 ? '99+' : contact.unread}
              </Text>
            </Badge>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
