import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor } from '@theme';

import { useContactNames } from '../hooks/use-contact-names';

import {
  COMPOSER_BG_DARK,
  COMPOSER_BG_LIGHT,
  HAIRLINE_DARK,
  HAIRLINE_LIGHT,
  INPUT_BG_DARK,
  INPUT_BG_LIGHT,
} from './composer-colors';
import { SaveContactButton } from './contacts/SaveContactButton';
import { WhatsappWindowTimer } from './WhatsappWindowTimer';

interface Props {
  name: string;
  subtitle: string;
  /** Lead linked to this conversation; tapping name/subtitle opens its detail. */
  leadId?: string;
  /** Customer phone. Drives saved-contact name resolution and the add-to-contacts action. */
  phone?: string;
  /** Conversation id — opens the details screen. */
  conversationId: string;
  /** Channel string ('whatsapp' | 'messenger' | ...). */
  channel: string;
  /** Absolute ISO expiry of the WhatsApp 24h window; drives the countdown badge. */
  windowExpiresAt?: string | null;
  /** Server window flag. `undefined` (loading / Messenger) hides the badge. */
  withinWindow?: boolean;
}

function HeaderIconButton({
  icon,
  label,
  onPress,
}: Readonly<{
  icon: 'ArrowLeft' | 'Info';
  label: string;
  onPress: () => void;
}>) {
  const fg = useThemeColor('--foreground');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
    >
      <Icon name={icon} size={22} color={fg} />
    </Pressable>
  );
}

export function ConversationHeader({
  name,
  subtitle,
  leadId,
  phone,
  conversationId,
  channel,
  windowExpiresAt = null,
  withinWindow,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const headerBg = isDark ? COMPOSER_BG_DARK : COMPOSER_BG_LIGHT;
  const hairline = isDark ? HAIRLINE_DARK : HAIRLINE_LIGHT;
  const avatarBg = isDark ? INPUT_BG_DARK : INPUT_BG_LIGHT;
  const avatarIcon = useThemeColor('--muted-foreground');
  // A saved phonebook name outranks the WhatsApp profile name, matching the web
  // client — the agent's own label for a customer is the one they recognise.
  const { resolve } = useContactNames();
  const displayName = resolve(phone, name);
  // A real name has at least one letter; empty or number-only (a raw phone) is
  // treated as "no name" → generic user avatar.
  const hasName = /[a-zA-Z]/.test(displayName);
  const openLead = (): void => {
    if (leadId !== undefined && leadId !== '') router.push(`/leads/${leadId}`);
  };
  const openDetails = (): void => {
    router.push({
      pathname: '/chat/details',
      params: { conversationId, channel, leadId: leadId ?? '' },
    });
  };
  const hasLead = leadId !== undefined && leadId !== '';

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        backgroundColor: headerBg,
        borderBottomWidth: 1,
        borderBottomColor: hairline,
      }}
    >
      <View className="flex-row items-center px-3 pb-3 pt-1">
        <HeaderIconButton
          icon="ArrowLeft"
          label="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
        />

        <Avatar alt={displayName} className="ml-1 h-10 w-10">
          {hasName ? (
            <AvatarFallback style={{ backgroundColor: avatarBg }} textClassName="text-foreground">
              <Text>{initials(displayName)}</Text>
            </AvatarFallback>
          ) : (
            <AvatarFallback style={{ backgroundColor: avatarBg }} textClassName="text-foreground">
              <Icon name="User" size={22} color={avatarIcon} />
            </AvatarFallback>
          )}
        </Avatar>

        <Pressable
          onPress={openLead}
          disabled={!hasLead}
          accessibilityRole={hasLead ? 'button' : 'header'}
          accessibilityLabel={hasLead ? `Open lead ${displayName}` : undefined}
          className={cn('ml-3 flex-1', hasLead ? 'active:opacity-70' : undefined)}
        >
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {displayName}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-1">
          <WhatsappWindowTimer windowExpiresAt={windowExpiresAt} withinWindow={withinWindow} />
          <SaveContactButton phone={phone} profileName={name} />
          <HeaderIconButton icon="Info" label="Conversation details" onPress={openDetails} />
        </View>
      </View>
    </View>
  );
}
