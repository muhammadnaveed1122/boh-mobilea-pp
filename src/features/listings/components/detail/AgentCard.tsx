import { Linking, Pressable, View } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import type { ListingPersonRef } from '../../types';

function open(url: string): void {
  Linking.openURL(url).catch(() => {});
}

function ContactButton({
  icon,
  label,
  tone,
  onPress,
}: Readonly<{ icon: IconName; label: string; tone: 'light' | 'whatsapp'; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-xl active:opacity-80 ${
        tone === 'whatsapp' ? 'bg-[#25D366]' : 'bg-brand-foreground/15'
      }`}
    >
      <Icon name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

export function AgentCard({ agent }: Readonly<{ agent?: ListingPersonRef | null }>) {
  const name = agent?.name?.trim();
  if (!agent || !name) return null;

  const phone = agent.phone?.trim();
  const whatsapp = agent.whatsapp?.trim() ?? phone;

  return (
    <View className="mb-3 overflow-hidden rounded-2xl bg-brand p-4">
      <Text className="mb-3 text-sm font-semibold text-brand-foreground/70">Presented by</Text>

      <View className="flex-row items-center gap-3">
        <Avatar alt={name} className="h-14 w-14 bg-brand-foreground/15">
          {agent.avatarUrl ? <AvatarImage source={{ uri: agent.avatarUrl }} /> : null}
          <AvatarFallback className="bg-brand-foreground/15">
            <Text className="text-base font-bold text-brand-foreground">{initials(name)}</Text>
          </AvatarFallback>
        </Avatar>

        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-brand-foreground" numberOfLines={1}>
            {name}
          </Text>
          {agent.role ? (
            <Text className="text-xs text-brand-foreground/70" numberOfLines={1}>
              {agent.role}
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-2">
          {phone ? (
            <ContactButton
              icon="Phone"
              label="Call agent"
              tone="light"
              onPress={() => open(`tel:${phone}`)}
            />
          ) : null}
          {whatsapp ? (
            <ContactButton
              icon="MessageCircle"
              label="WhatsApp agent"
              tone="whatsapp"
              onPress={() => open(`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
