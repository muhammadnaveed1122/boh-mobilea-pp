import { View } from 'react-native';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Dot } from '@/components/atoms/Dot';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';

import type { Agent } from '../types';

/** Single agent row: avatar (image or initials fallback), name/email, presence dot. */
export function AgentRow({ agent }: Readonly<{ agent: Agent }>) {
  const name = `${agent.firstName} ${agent.lastName}`.trim();
  const displayName = name.length > 0 ? name : agent.email;

  return (
    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
      <Avatar alt={displayName} className="h-10 w-10">
        {agent.avatarUrl ? <AvatarImage source={{ uri: agent.avatarUrl }} /> : null}
        <AvatarFallback>
          <Text className="text-xs">{initials(name)}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {displayName}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {agent.email}
        </Text>
      </View>
      <Dot className={agent.isOnline ? 'bg-success' : 'bg-muted-foreground'} />
    </View>
  );
}
