import { View } from 'react-native';

import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import { useThemeColor } from '@theme';

import { CHANNEL_META, type Channel } from '../../models/channel';
import { ChannelIcon } from '../ChannelIcon';

export function ProfileCard({ name, channel }: Readonly<{ name: string; channel: string }>) {
  const meta = CHANNEL_META[channel as Channel] as (typeof CHANNEL_META)[Channel] | undefined;
  // Hooks must run unconditionally — resolve an accent even when meta is absent.
  const accent = useThemeColor(meta?.accentToken ?? '--info');

  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <View className="relative">
        <Avatar alt={name} className="h-14 w-14">
          <AvatarFallback>
            <Text className="text-lg font-semibold">{initials(name)}</Text>
          </AvatarFallback>
        </Avatar>
        {meta ? (
          <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-card">
            <ChannelIcon channel={channel as Channel} size={14} color={accent} />
          </View>
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-bold" numberOfLines={1}>
          {name || 'Unknown contact'}
        </Text>
        {meta ? <Text className="text-sm text-muted-foreground">{meta.label}</Text> : null}
      </View>
    </View>
  );
}
